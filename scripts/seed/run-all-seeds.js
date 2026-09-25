/**
 * Script de inicialización de migraciones y población de seeders (UAJS Smart Campus).
 * Ejecuta los scripts SQL de inicialización y seeders en orden de dependencia.
 */

const fs = require('fs');
const path = require('path');

const mysql = require('mysql2/promise');

// Configuración de conexión con fallback inteligente para desarrollo local / docker
const DB_CONFIGS = [
  {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'uajs_user',
    password: process.env.MYSQL_PASSWORD || 'uajs206**',
  },
  {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
  },
  {
    host: '127.0.0.1',
    port: 3307, // Docker compose externo
    user: 'root',
    password: 'rootpassword',
  },
];

async function getAvailableConnection() {
  for (const config of DB_CONFIGS) {
    try {
      const conn = await mysql.createConnection({
        ...config,
        multipleStatements: true,
        connectTimeout: 2000,
      });
      console.log(
        `[DB] Conectado exitosamente con usuario '${config.user}' en ${config.host}:${config.port}`,
      );
      return conn;
    } catch (err) {
      // Intentar la siguiente configuración
    }
  }
  throw new Error(
    'No se pudo establecer conexión con ninguna instancia de MySQL / MariaDB disponible.',
  );
}

async function executeSqlFile(conn, filePath) {
  const fileName = path.basename(filePath);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] Archivo no encontrado: ${fileName}`);
    return;
  }

  const rawSql = fs.readFileSync(filePath, 'utf8');
  // Dividir por sentencias asegurando ejecución controlada
  const statements = rawSql
    .split(/;\s*[\r\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`[SQL] Ejecutando ${fileName} (${statements.length} sentencias)...`);

  for (const stmt of statements) {
    try {
      await conn.query(stmt);
    } catch (err) {
      // Ignorar advertencias menores como tablas o registros ya existentes si es idempotente
      if (err.code !== 'ER_TABLE_EXISTS_ERROR' && err.code !== 'ER_DUP_ENTRY') {
        const preview = `${stmt.substring(0, 120)}...`;
        console.error(`[ERROR] en sentencia de ${fileName}:\n${preview}\nDetalle: ${err.message}`);
        throw err;
      }
    }
  }
  console.log(`[OK] ${fileName} completado con éxito.`);
}

async function main() {
  console.log('============================================================');
  console.log(' UAJS SMART CAMPUS — MIGRACIONES Y SEEDERS DEL SISTEMA');
  console.log('============================================================\n');

  const conn = await getAvailableConnection();

  try {
    // 1. Asegurar bases de datos principales
    const databases = [
      'uajs_catalog',
      'uajs_auth',
      'uajs_academic',
      'uajs_resources',
      'uajs_bookings',
      'uajs_events',
      'uajs_requests',
      'uajs_notifications',
    ];

    const isFresh = process.argv.includes('--clean') || process.argv.includes('--fresh');
    if (isFresh) {
      console.log('[DB] Limpiando todas las bases de datos de microservicios (--clean)...');
      await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
      for (const db of databases) {
        await conn.query(`DROP DATABASE IF EXISTS \`${db}\`;`);
      }
      await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
      console.log('[DB] Bases de datos limpiadas exitosamente.');
    }

    for (const db of databases) {
      await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      );
    }
    console.log('[DB] Todas las bases de datos de microservicios han sido verificadas.');

    // Verificar si uajs_catalog requiere actualización de esquema
    try {
      const [cols] = await conn.query(
        "SHOW COLUMNS FROM uajs_catalog.departments LIKE 'country_id'",
      );
      if (cols.length === 0) {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0;');
        await conn.query('DROP TABLE IF EXISTS uajs_catalog.cities;');
        await conn.query('DROP TABLE IF EXISTS uajs_catalog.departments;');
        await conn.query('DROP TABLE IF EXISTS uajs_catalog.countries;');
        await conn.query('DROP TABLE IF EXISTS uajs_catalog.document_types;');
        await conn.query('DROP TABLE IF EXISTS uajs_catalog.campuses;');
        await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log(
          '[DB] Estructura anterior de uajs_catalog actualizada para aplicar esquema canónico.',
        );
      }
    } catch (e) {
      // Si la tabla aún no existe, continúa normalmente
    }

    // 2. Ejecutar Migraciones DDL (Estructura de tablas)
    console.log('\n--- PASO 1: APLICACIÓN DE MIGRACIONES (DDL) ---');
    const migrations = [
      'ms-catalog_001_init.sql',
      'ms-auth_001_init.sql',
      'ms-academic_001_init.sql',
      'ms-resources_001_init.sql',
      'ms-bookings_001_init.sql',
      'ms-events_001_init.sql',
      'ms-requests_001_init.sql',
      'ms-notifications_001_init.sql',
    ];

    for (const migration of migrations) {
      const p = path.join(__dirname, '..', 'migrations', migration);
      await executeSqlFile(conn, p);
    }

    // 3. Ejecutar Seeders (Población de catálogos y datos iniciales)
    console.log('\n--- PASO 2: POBLACIÓN DE SEEDERS ---');
    const seeds = [
      'ms-catalog_001_seed.sql', // Catálogo geográfico y tipos de documento
      'ms-academic_001_seed.sql', // Sedes, facultades, programas y convenios
      'ms-auth_001_seed.sql', // Roles y permisos base
      'ms-users-and-roles_001_seed.sql', // Personas, usuarios, estudiantes, docentes y admin
      'ms-resources_001_seed.sql', // Categorías y estados de recursos
      'ms-bookings_001_seed.sql', // Tipos y estados de reservas
      'ms-events_001_seed.sql', // Categorías y estados de eventos
      'ms-requests_001_seed.sql', // Categorías, tipos y estados de solicitudes
      'ms-notifications_001_seed.sql', // Plantillas de notificación
    ];

    for (const seed of seeds) {
      const p = path.join(__dirname, seed);
      await executeSqlFile(conn, p);
    }

    // 4. Verificación y resumen de datos
    console.log('\n============================================================');
    console.log(' RESUMEN DE POBLACIÓN DE DATOS');
    console.log('============================================================');

    const [[{ totalUsers }]] = await conn.query(
      'SELECT COUNT(*) as totalUsers FROM uajs_auth.users;',
    );
    const [[{ totalRoles }]] = await conn.query(
      'SELECT COUNT(*) as totalRoles FROM uajs_auth.roles;',
    );
    const [[{ totalStudents }]] = await conn.query(
      'SELECT COUNT(*) as totalStudents FROM uajs_academic.students;',
    );
    const [[{ totalTeachers }]] = await conn.query(
      'SELECT COUNT(*) as totalTeachers FROM uajs_academic.teachers;',
    );
    const [[{ totalFaculties }]] = await conn.query(
      'SELECT COUNT(*) as totalFaculties FROM uajs_academic.faculties;',
    );
    const [[{ totalPrograms }]] = await conn.query(
      'SELECT COUNT(*) as totalPrograms FROM uajs_academic.programs;',
    );
    const [[{ totalCities }]] = await conn.query(
      'SELECT COUNT(*) as totalCities FROM uajs_catalog.cities;',
    );

    console.log(`- Ciudades en catálogo:      ${totalCities}`);
    console.log(`- Facultades registradas:    ${totalFaculties}`);
    console.log(`- Programas académicos:      ${totalPrograms}`);
    console.log(`- Roles en sistema:          ${totalRoles}`);
    console.log(`- Usuarios creados:          ${totalUsers}`);
    console.log(`- Estudiantes vinculados:    ${totalStudents}`);
    console.log(`- Docentes vinculados:       ${totalTeachers}`);

    console.log('\n------------------------------------------------------------');
    console.log(' USUARIOS DE PRUEBA CREADOS (Contraseña: Campus2026!*)');
    console.log('------------------------------------------------------------');
    const [userRows] = await conn.query(`
      SELECT 
        u.id, 
        u.email, 
        CONCAT(p.first_name, ' ', p.last_name) as persona,
        r.name as rol,
        COALESCE(s.student_code, t.teacher_code, 'N/A') as codigo_academico
      FROM uajs_auth.users u
      JOIN uajs_auth.persons p ON p.id = u.person_id
      LEFT JOIN uajs_auth.user_roles ur ON ur.user_id = u.id
      LEFT JOIN uajs_auth.roles r ON r.id = ur.role_id
      LEFT JOIN uajs_academic.students s ON s.user_uuid = u.uuid
      LEFT JOIN uajs_academic.teachers t ON t.user_uuid = u.uuid
      WHERE r.name NOT IN ('SUPERADMIN', 'ADMIN', 'STAFF', 'TEACHER', 'STUDENT')
      ORDER BY u.id ASC;
    `);

    console.table(userRows);
    console.log('\n¡Sembrado de datos finalizado exitosamente!');
  } catch (err) {
    console.error('\n[FATAL] Error en la ejecución de seeders:', err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
