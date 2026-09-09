# Infraestructura Local — UAJS Smart Campus

Este directorio contiene la configuración para levantar el entorno de desarrollo completo con Docker Compose.

## Requisitos previos

- Docker Engine 20.10+
- Docker Compose 2.0+
- Node.js 20 (para ejecutar scripts de migración fuera del contenedor)
- Git

## Estructura

```
docker/
├── init/                 # Scripts de inicialización de bases de datos
│   └── 01-schema.sql     # Script SQL completo (35+ tablas)
├── Dockerfile.base       # Imagen base compartida para todos los servicios
├── docker-compose.yml    # Orquestación de todos los servicios
└── README.md             # Este archivo
```

## Servicios incluidos

| Servicio             | Puerto | Descripción                                      |
| -------------------- | ------ | ------------------------------------------------ |
| MySQL 8              | 3306   | Base de datos principal y de test                |
| Redis 7 (AOF)        | 6379   | Caché y colas BullMQ con persistencia            |
| api-gateway          | 3000   | Gateway de entrada                               |
| auth-service         | 3001   | Autenticación y autorización                     |
| user-service         | 3002   | Gestión de usuarios                              |
| catalog-service      | 3003   | Catálogos (departamentos, ciudades, etc.)        |
| university-service   | 3004   | Universidad (facultades, programas, estudiantes) |
| resource-service     | 3005   | Recursos (aulas, laboratorios, etc.)             |
| booking-service      | 3006   | Reservas de recursos                             |
| request-service      | 3007   | Solicitudes                                      |
| event-service        | 3008   | Eventos                                          |
| notification-service | 3009   | Notificaciones                                   |
| pqrs-service         | 3010   | PQRS                                             |
| storage-service      | 3011   | Almacenamiento de archivos                       |

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto (o en el mismo directorio que `docker-compose.yml`) con las siguientes variables:

```env
MYSQL_ROOT_PASSWORD=uajs206**
MYSQL_USER=uajs_user
MYSQL_PASSWORD=uajs206**
JWT_ACCESS_SECRET=change_this_in_production_32chars_min
JWT_REFRESH_SECRET=change_this_in_production_32chars_min
SERVICE_AUTH_TOKEN=uajs_service_token_2024
```

## Comandos principales

### Levantar todo el entorno

```bash
docker-compose up -d
```

### Levantar solo bases de datos (útil para desarrollo)

```bash
docker-compose up -d mysql redis
```

### Ver logs de un servicio específico

```bash
docker-compose logs -f auth-service
```

### Detener y eliminar contenedores (sin borrar volúmenes)

```bash
docker-compose down
```

### Detener y eliminar contenedores + volúmenes (pérdida de datos)

```bash
docker-compose down -v
```

### Reconstruir servicios después de cambios en el código

```bash
docker-compose up -d --build
```

### Acceder a la consola de MySQL

```bash
docker exec -it uajs-mysql mysql -u root -p
```

### Acceder a la consola de Redis

```bash
docker exec -it uajs-redis redis-cli
```

## Persistencia de datos

- **MySQL**: Los datos se guardan en el volumen `mysql_data`.
- **Redis**: AOF (Append Only File) activado, los datos se guardan en `redis_data`.
- **Archivos subidos**: Se almacenan en `storage_uploads`.

## Healthchecks

Cada servicio expone el endpoint `/health`. Docker Compose los utiliza para determinar si el servicio está listo antes de iniciar dependencias.

## Base de datos de pruebas

El script `01-schema.sql` crea automáticamente la base de datos `uajs_smart_campus_test` con el mismo esquema. Esta base se usa para ejecutar pruebas de integración.

## Migraciones

El runner de migraciones se encuentra en `scripts/migrations/migrate.js`. Para ejecutarlo:

```bash
node scripts/migrations/migrate.js up      # Aplica migraciones pendientes
node scripts/migrations/migrate.js status  # Muestra el estado de las migraciones
node scripts/migrations/migrate.js down 1  # Revierte la última migración
```

## Notas sobre el modo desarrollo

- El código se monta mediante volúmenes, por lo que los cambios en el código fuente se reflejan instantáneamente (con reinicio automático gracias a nodemon).
- Cada servicio ejecuta `npx nodemon apps/<servicio>/src/index.js` para hot-reload.
- Para producción se deben construir imágenes optimizadas con Dockerfiles específicos.

## Troubleshooting

### Error "Connection refused" al conectar a MySQL

- Asegurar que MySQL esté healthy (`docker-compose ps`).
- Esperar unos segundos adicionales después del healthcheck.

### Error de permisos en volúmenes

Ejecutar `chown -R 1000:1000 .` en la raíz del proyecto (o usar `USER node` en los Dockerfiles).

### Redis no persiste

- Verificar que el comando de Redis incluya `--appendonly yes`.
- Revisar que el volumen `redis_data` esté correctamente montado.

### Reconstrucción de servicios con cambios en package.json

Eliminar el volumen `node_modules` o ejecutar `docker-compose up -d --build --force-recreate`.

## Puerta de Verificación

### Levantar contenedores de base de datos

```bash
cd infrastructure/docker
docker-compose up -d mysql redis
```

### Verificar healthchecks

```bash
docker-compose ps
# Debe mostrar ambos servicios como "healthy"
```

### Listar tablas en la base de datos

```bash
docker exec -it uajs-mysql mysql -u root -p -e "USE uajs_smart_campus; SHOW TABLES;"
# Debe mostrar al menos 36 tablas
```

### Verificar existencia de base de datos de test

```bash
docker exec -it uajs-mysql mysql -u root -p -e "SHOW DATABASES;"
# Debe aparecer uajs_smart_campus_test
```

### Ejecutar migraciones

```bash
node scripts/migrations/migrate.js status
# Debe mostrar las migraciones (al menos 001_init.sql)
node scripts/migrations/migrate.js up
# Debe aplicar la migración inicial
```

### Prueba de integridad FK

```sql
-- Verificar que las restricciones estén activas
SELECT CONSTRAINT_NAME, TABLE_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE CONSTRAINT_TYPE = 'FOREIGN KEY' AND TABLE_SCHEMA = 'uajs_smart_campus';
```

---

### Archivo: `scripts/migrations/migrate.js`

```javascript
#!/usr/bin/env node

/**
 * Runner de migraciones SQL versionadas para UAJS Smart Campus
 *
 * Uso:
 *   node migrate.js up          # Aplica todas las migraciones pendientes (default)
 *   node migrate.js status      # Muestra el estado de las migraciones
 *   node migrate.js down N      # Revertir las últimas N migraciones
 *
 * Archivos de migración: scripts/migrations/*.sql (orden alfabético)
 * Tabla de control: _migrations
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { readdir } = require('fs').promises;

// Configuración desde variables de entorno
const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'uajs_user',
  password: process.env.MYSQL_PASSWORD || 'uajs206**',
  database: process.env.MYSQL_DATABASE || 'uajs_smart_campus',
  multipleStatements: true,
};

// Directorio de migraciones
const MIGRATIONS_DIR = path.join(__dirname);

// Colores para la salida en consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  raw: (msg) => console.log(msg),
};

async function getConnection() {
  const conn = await mysql.createConnection({
    ...config,
    multipleStatements: true,
  });
  await conn.query(`USE \`${config.database}\``);
  return conn;
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      migration VARCHAR(255) NOT NULL,
      batch INT UNSIGNED NOT NULL,
      executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_migrations_name (migration)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function getExecutedMigrations(conn) {
  const [rows] = await conn.query('SELECT migration, batch FROM _migrations ORDER BY id');
  return rows.map((r) => r.migration);
}

async function getLastBatch(conn) {
  const [rows] = await conn.query('SELECT MAX(batch) AS max_batch FROM _migrations');
  return rows[0].max_batch || 0;
}

async function getMigrationFiles() {
  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter((f) => f.endsWith('.sql') && f !== '_migrations.sql').sort();
  return sqlFiles;
}

async function runMigration(conn, filePath, migrationName, batch) {
  log.info(`Ejecutando migración: ${migrationName}`);
  const sql = await fs.readFile(filePath, 'utf8');
  await conn.beginTransaction();

  try {
    await conn.query(sql);
    await conn.query('INSERT INTO _migrations (migration, batch) VALUES (?, ?)', [
      migrationName,
      batch,
    ]);
    await conn.commit();
    log.success(`Migración ${migrationName} completada`);
    return true;
  } catch (err) {
    await conn.rollback();
    log.error(`Error en migración ${migrationName}: ${err.message}`);
    throw err;
  }
}

async function up() {
  let conn;
  try {
    conn = await getConnection();
    await ensureMigrationsTable(conn);

    const executed = await getExecutedMigrations(conn);
    const files = await getMigrationFiles();
    const pending = files.filter((f) => !executed.includes(f));

    if (pending.length === 0) {
      log.info('No hay migraciones pendientes.');
      return;
    }

    log.info(`Se encontraron ${pending.length} migraciones pendientes.`);
    const batch = (await getLastBatch(conn)) + 1;

    for (const file of pending) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      await runMigration(conn, filePath, file, batch);
    }

    log.success(`✅ Todas las migraciones aplicadas (batch ${batch}).`);
  } catch (err) {
    log.error(`Fallo al aplicar migraciones: ${err.message}`);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

async function down(count) {
  if (!count || count < 1) {
    log.error('Debe especificar un número N de migraciones a revertir (down N)');
    process.exit(1);
  }

  let conn;
  try {
    conn = await getConnection();
    await ensureMigrationsTable(conn);

    const lastBatch = await getLastBatch(conn);
    if (lastBatch === 0) {
      log.warn('No hay migraciones para revertir.');
      return;
    }

    const [rows] = await conn.query(
      'SELECT migration FROM _migrations WHERE batch = ? ORDER BY id DESC LIMIT ?',
      [lastBatch, count],
    );

    if (rows.length === 0) {
      log.warn('No hay migraciones en el último batch.');
      return;
    }

    const migrationsToRevert = rows.map((r) => r.migration);
    log.info(`Revertiendo ${migrationsToRevert.length} migraciones...`);

    for (const migration of migrationsToRevert) {
      log.warn(`Revertir ${migration} requiere acción manual (DROP/ALTER).`);
      await conn.query('DELETE FROM _migrations WHERE migration = ?', [migration]);
      log.success(`Registro de ${migration} eliminado.`);
    }

    log.warn(`⚠️  Se eliminaron los registros de ${migrationsToRevert.length} migraciones.`);
    log.warn('Recuerde revertir manualmente los cambios en la base de datos.');
  } catch (err) {
    log.error(`Fallo al revertir migraciones: ${err.message}`);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

async function status() {
  let conn;
  try {
    conn = await getConnection();
    await ensureMigrationsTable(conn);

    const executed = await getExecutedMigrations(conn);
    const files = await getMigrationFiles();

    log.raw('');
    log.raw('📋 Estado de migraciones:');
    log.raw('─────────────────────────────────────────────');

    for (const file of files) {
      const isExecuted = executed.includes(file);
      const icon = isExecuted
        ? `${colors.green}✓${colors.reset}`
        : `${colors.gray}○${colors.reset}`;
      const statusText = isExecuted ? 'Aplicada' : 'Pendiente';
      log.raw(` ${icon} ${file.padEnd(40)} ${statusText}`);
    }

    log.raw('─────────────────────────────────────────────');
    const total = files.length;
    const applied = executed.filter((e) => files.includes(e)).length;
    log.raw(` Total: ${total} | Aplicadas: ${applied} | Pendientes: ${total - applied}`);
    log.raw('');
  } catch (err) {
    log.error(`Error al obtener estado: ${err.message}`);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'up';
  const count = parseInt(args[1], 10);

  switch (command) {
    case 'up':
      await up();
      break;
    case 'down':
      await down(count);
      break;
    case 'status':
      await status();
      break;
    default:
      log.error(`Comando desconocido: ${command}`);
      log.info('Uso: node migrate.js [up|status|down N]');
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    log.error(`Error fatal: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { up, down, status };
```
