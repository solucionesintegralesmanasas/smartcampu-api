#!/usr/bin/env node

/**
 * Runner de migraciones SQL para UAJS Smart Campus (database-per-service).
 *
 * Uso:
 *   node scripts/migrations/migrate.js up       # Aplica las migraciones pendientes (default)
 *   node scripts/migrations/migrate.js status   # Muestra el estado de cada migración
 *   node scripts/migrations/migrate.js down N   # Elimina el registro de las últimas N migraciones
 *
 * Cada archivo ms-*_001_init.sql crea su propia base de datos. El runner
 * detecta esa base a partir del CREATE DATABASE del archivo y lleva el control
 * en la tabla `_migrations` de cada base.
 *
 * Variables de entorno:
 *   MYSQL_HOST (127.0.0.1), MYSQL_PORT (3306),
 *   MYSQL_ROOT_USER (root), MYSQL_ROOT_PASSWORD ('')
 *
 * Nota: el DDL de MySQL no es transaccional. Las migraciones son idempotentes
 * (CREATE ... IF NOT EXISTS), por lo que reintentar tras un fallo es seguro.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = __dirname;
const CONTROL_TABLE = '_migrations';
const DB_NAME_REGEX = /CREATE DATABASE IF NOT EXISTS\s+`?([A-Za-z0-9_]+)`?/i;

const getConfig = () => ({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_ROOT_USER || process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASSWORD || '',
  multipleStatements: true,
});

const log = {
  info: (msg) => console.log(`ℹ ${msg}`),
  ok: (msg) => console.log(`✓ ${msg}`),
  warn: (msg) => console.warn(`⚠ ${msg}`),
  error: (msg) => console.error(`✗ ${msg}`),
};

const loadMigrations = () => fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const match = sql.match(DB_NAME_REGEX);
    if (!match) {
      throw new Error(`${file}: no se encontró 'CREATE DATABASE IF NOT EXISTS'`);
    }
    return {
      name: file,
      database: match[1],
      sql,
      checksum: crypto.createHash('sha256').update(sql).digest('hex'),
    };
  });

const connect = () => mysql.createConnection(getConfig());

const controlTableExists = async (conn, database) => {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    [database, CONTROL_TABLE],
  );
  return rows.length > 0;
};

const ensureControlTable = async (conn, database) => {
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` `
      + 'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`${database}\`.\`${CONTROL_TABLE}\` (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      migration VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      batch INT UNSIGNED NOT NULL,
      executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_migrations_name (migration)
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);
};

const getApplied = async (conn, database) => {
  if (!(await controlTableExists(conn, database))) {
    return new Map();
  }
  const [rows] = await conn.query(
    `SELECT migration, checksum, batch, executed_at FROM \`${database}\`.\`${CONTROL_TABLE}\``,
  );
  return new Map(rows.map((row) => [row.migration, row]));
};

const up = async () => {
  const migrations = loadMigrations();
  const conn = await connect();

  try {
    let applied = 0;

    for (const migration of migrations) {
      const {
        name,
        database,
        sql,
        checksum,
      } = migration;
      await ensureControlTable(conn, database);

      const record = (await getApplied(conn, database)).get(name);
      if (record) {
        if (record.checksum !== checksum) {
          log.warn(
            `${name} cambió desde que se aplicó (checksum distinto). `
              + `Revise ${database} manualmente.`,
          );
        }
      } else {
        log.info(`Aplicando ${name} → ${database}`);
        await conn.query(sql);

        const [[{ next }]] = await conn.query(
          `SELECT COALESCE(MAX(batch), 0) + 1 AS next FROM \`${database}\`.\`${CONTROL_TABLE}\``,
        );
        await conn.query(
          `INSERT INTO \`${database}\`.\`${CONTROL_TABLE}\` `
            + '(migration, checksum, batch) VALUES (?, ?, ?)',
          [name, checksum, next],
        );
        applied += 1;
        log.ok(`${name} aplicada`);
      }
    }

    log.ok(applied === 0 ? 'No hay migraciones pendientes.' : `${applied} migración(es) aplicada(s).`);
  } finally {
    await conn.end();
  }
};

const status = async () => {
  const migrations = loadMigrations();
  const conn = await connect();

  try {
    let appliedCount = 0;

    console.log('\nEstado de migraciones:');
    console.log('─'.repeat(72));

    for (const migration of migrations) {
      const isApplied = (await getApplied(conn, migration.database)).has(migration.name);
      if (isApplied) appliedCount += 1;
      const icon = isApplied ? '✓' : '○';
      const text = isApplied ? 'Aplicada' : 'Pendiente';
      console.log(` ${icon} ${migration.name.padEnd(32)} ${migration.database.padEnd(18)} ${text}`);
    }

    console.log('─'.repeat(72));
    const pendingCount = migrations.length - appliedCount;
    console.log(
      ` Total: ${migrations.length} | Aplicadas: ${appliedCount} | Pendientes: ${pendingCount}\n`,
    );
  } finally {
    await conn.end();
  }
};

const down = async (count) => {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Debe indicar N (entero mayor a 0): node migrate.js down N');
  }

  const migrations = loadMigrations();
  const conn = await connect();

  try {
    const records = [];
    for (const migration of migrations) {
      const applied = await getApplied(conn, migration.database);
      applied.forEach((row) => {
        records.push({ database: migration.database, ...row });
      });
    }

    records.sort((a, b) => {
      const byDate = new Date(b.executed_at) - new Date(a.executed_at);
      return byDate || b.migration.localeCompare(a.migration);
    });

    const toRevert = records.slice(0, count);
    if (toRevert.length === 0) {
      log.warn('No hay migraciones registradas para revertir.');
      return;
    }

    for (const row of toRevert) {
      await conn.query(
        `DELETE FROM \`${row.database}\`.\`${CONTROL_TABLE}\` WHERE migration = ?`,
        [row.migration],
      );
      log.ok(`Registro de ${row.migration} (${row.database}) eliminado.`);
    }

    log.warn('Solo se eliminaron los registros. Revierta el esquema manualmente (DROP/ALTER).');
  } finally {
    await conn.end();
  }
};

const main = async () => {
  const [command = 'up', rawCount] = process.argv.slice(2);

  try {
    if (command === 'up') {
      await up();
    } else if (command === 'status') {
      await status();
    } else if (command === 'down') {
      await down(parseInt(rawCount, 10));
    } else {
      throw new Error(`Comando desconocido: ${command}. Use up | status | down N`);
    }
  } catch (err) {
    log.error(`Fallo en migraciones: ${err.message}`);
    process.exitCode = 1;
  }
};

if (require.main === module) {
  main();
}

module.exports = {
  loadMigrations,
  up,
  status,
  down,
};
