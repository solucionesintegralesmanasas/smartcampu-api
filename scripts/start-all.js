#!/usr/bin/env node

/**
 * Orquestador de arranque para contenedores del monorepo UAJS Smart Campus.
 *
 * Modos de ejecución según SERVICE_NAME:
 *  - SERVICE_NAME=all (o sin definir): inicia los 11 microservicios internos
 *    en loopback (puertos 3001-3011) y el api-gateway en el puerto público
 *    (PORT || 3000) dentro del mismo contenedor.
 *  - SERVICE_NAME=<servicio>: inicia únicamente apps/<servicio>/src/server.js.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

const INTERNAL_SERVICES = [
  {
    name: 'auth-service',
    port: 3001,
    database: 'uajs_auth',
    envKey: 'SERVICE_AUTH_URL',
  },
  {
    name: 'user-service',
    port: 3002,
    database: 'uajs_auth',
    envKey: 'SERVICE_USER_URL',
    extraEnv: {
      SERVICE_UNIVERSITY_URL: 'http://127.0.0.1:3004',
    },
  },
  {
    name: 'catalog-service',
    port: 3003,
    database: 'uajs_catalog',
    envKey: 'SERVICE_CATALOG_URL',
  },
  {
    name: 'university-service',
    port: 3004,
    database: 'uajs_academic',
    envKey: 'SERVICE_UNIVERSITY_URL',
  },
  {
    name: 'resource-service',
    port: 3005,
    database: 'uajs_resources',
    envKey: 'SERVICE_RESOURCE_URL',
  },
  {
    name: 'booking-service',
    port: 3006,
    database: 'uajs_bookings',
    envKey: 'SERVICE_BOOKING_URL',
    extraEnv: {
      SERVICE_RESOURCE_URL: 'http://127.0.0.1:3005',
    },
  },
  {
    name: 'request-service',
    port: 3007,
    database: 'uajs_requests',
    envKey: 'SERVICE_REQUEST_URL',
    extraEnv: {
      SERVICE_STORAGE_URL: 'http://127.0.0.1:3011',
    },
  },
  {
    name: 'event-service',
    port: 3008,
    database: 'uajs_events',
    envKey: 'SERVICE_EVENT_URL',
  },
  {
    name: 'notification-service',
    port: 3009,
    database: 'uajs_notifications',
    envKey: 'SERVICE_NOTIFICATION_URL',
  },
  {
    name: 'pqrs-service',
    port: 3010,
    database: 'uajs_pqrs',
    envKey: 'SERVICE_PQRS_URL',
    extraEnv: {
      SERVICE_STORAGE_URL: 'http://127.0.0.1:3011',
    },
  },
  {
    name: 'storage-service',
    port: 3011,
    database: 'uajs_storage',
    envKey: 'SERVICE_STORAGE_URL',
    extraEnv: {
      STORAGE_PATH: '/uploads',
    },
  },
];

const FALLBACK_JWT_SECRET = [
  'uajs_smart_campus_fallback_jwt_secret',
  'configurar_en_produccion_64chars',
].join('_');
const FALLBACK_JWT_REFRESH_SECRET = [
  'uajs_smart_campus_fallback_refresh_secret',
  'configurar_en_produccion_64chars',
].join('_');
const FALLBACK_SERVICE_TOKEN = 'uajs_smart_campus_fallback_service_token_32chars';

/**
 * Asegura variables mínimas requeridas por Zod para evitar caídas inmediatas
 * al levantar un entorno nuevo sin secretos configurados aún.
 */
function prepararVariablesEntorno() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 64) {
    console.warn(
      '[start-all] ADVERTENCIA: JWT_SECRET no definido o menor a 64 caracteres. Usando valor de respaldo temporal; configure JWT_SECRET en los secretos de producción.',
    );
    process.env.JWT_SECRET = FALLBACK_JWT_SECRET;
  }

  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 64) {
    console.warn(
      '[start-all] ADVERTENCIA: JWT_REFRESH_SECRET no definido o menor a 64 caracteres. Usando valor de respaldo temporal; configure JWT_REFRESH_SECRET en los secretos de producción.',
    );
    process.env.JWT_REFRESH_SECRET = FALLBACK_JWT_REFRESH_SECRET;
  }

  if (!process.env.SERVICE_AUTH_TOKEN || process.env.SERVICE_AUTH_TOKEN.length < 32) {
    console.warn(
      '[start-all] ADVERTENCIA: SERVICE_AUTH_TOKEN no definido o menor a 32 caracteres. Usando valor de respaldo temporal; configure SERVICE_AUTH_TOKEN en los secretos de producción.',
    );
    process.env.SERVICE_AUTH_TOKEN = FALLBACK_SERVICE_TOKEN;
  }

  if (!process.env.CORS_ALLOWED_ORIGINS) {
    process.env.CORS_ALLOWED_ORIGINS = '*';
  }

  if (!process.env.REDIS_HOST) {
    process.env.REDIS_HOST = '127.0.0.1';
  }

  if (!process.env.ELASTICSEARCH_HOST) {
    process.env.ELASTICSEARCH_HOST = '127.0.0.1';
  }
}

/**
 * Ejecuta migraciones y semillas de forma asíncrona no bloqueante cuando
 * AUTO_MIGRATE=true, sin abortar el contenedor si MySQL aún no responde.
 */
function ejecutarAutoMigracionSiAplica() {
  if (process.env.AUTO_MIGRATE !== 'true') return;

  console.log('[start-all] AUTO_MIGRATE=true detectado. Ejecutando migraciones y semillas...');
  const seedScript = path.join(ROOT_DIR, 'scripts', 'seed', 'run-all-seeds.js');
  const migrator = spawn(process.execPath, [seedScript], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: 'inherit',
  });

  migrator.on('error', (err) => {
    console.warn(
      `[start-all] No se pudo iniciar la auto-migración (no fatal): ${err.message}`,
    );
  });

  migrator.on('exit', (code) => {
    if (code === 0) {
      console.log('[start-all] Auto-migración y semillas finalizadas correctamente.');
    } else {
      console.warn(
        `[start-all] Auto-migración terminó con código ${code} (no fatal; revise MySQL).`,
      );
    }
  });
}

/**
 * Inicia un microservicio individual en el directorio correspondiente.
 */
function iniciarProcesoServicio(serviceName, envOverrides = {}) {
  const serviceDir = path.join(ROOT_DIR, 'apps', serviceName);
  const entryFile = path.join(serviceDir, 'src', 'server.js');

  const child = spawn(process.execPath, [entryFile], {
    cwd: serviceDir,
    env: {
      ...process.env,
      ...envOverrides,
    },
    stdio: 'inherit',
  });

  return child;
}

/**
 * Resuelve las URLs internas para el api-gateway cuando todos los servicios
 * corren en la misma máquina.
 */
function construirEnvGatewayModoUnificado() {
  const gatewayEnv = {
    PORT: process.env.PORT || '3000',
  };

  for (const svc of INTERNAL_SERVICES) {
    const actual = process.env[svc.envKey];
    if (!actual || actual.includes('.internal')) {
      gatewayEnv[svc.envKey] = `http://127.0.0.1:${svc.port}`;
    } else {
      gatewayEnv[svc.envKey] = actual;
    }
  }

  return gatewayEnv;
}

function main() {
  prepararVariablesEntorno();
  ejecutarAutoMigracionSiAplica();

  const serviceName = (process.env.SERVICE_NAME || 'all').trim();
  const children = new Map();
  const estado = { apagando: false };

  const apagarTodos = (signal) => {
    if (estado.apagando) return;
    estado.apagando = true;
    console.log(`[start-all] Señal ${signal} recibida. Deteniendo procesos...`);

    for (const [name, child] of children.entries()) {
      if (!child.killed) {
        console.log(`[start-all] Deteniendo ${name} (PID ${child.pid})...`);
        child.kill(signal);
      }
    }

    setTimeout(() => {
      console.warn('[start-all] Tiempo de espera agotado; forzando cierre.');
      process.exit(0);
    }, 9000).unref();
  };

  process.on('SIGTERM', () => apagarTodos('SIGTERM'));
  process.on('SIGINT', () => apagarTodos('SIGINT'));

  if (serviceName && serviceName !== 'all') {
    console.log(`[start-all] Iniciando servicio individual: ${serviceName}`);
    const extraEnv = {};
    if (serviceName === 'api-gateway') {
      for (const svc of INTERNAL_SERVICES) {
        if (!process.env[svc.envKey]) {
          extraEnv[svc.envKey] = `http://${svc.name}:${svc.port}`;
        }
      }
    }

    const child = iniciarProcesoServicio(serviceName, extraEnv);
    children.set(serviceName, child);

    child.on('exit', (code, signal) => {
      if (estado.apagando) {
        process.exit(0);
      }
      console.error(
        `[start-all] ${serviceName} finalizó (código=${code}, señal=${signal || 'ninguna'}).`,
      );
      process.exit(code ?? 1);
    });
    return;
  }

  console.log('[start-all] Iniciando los 12 microservicios en modo unificado...');

  INTERNAL_SERVICES.forEach((svc) => {
    const child = iniciarProcesoServicio(svc.name, {
      PORT: String(svc.port),
      MYSQL_DATABASE: svc.database,
      ...(svc.extraEnv || {}),
    });
    children.set(svc.name, child);

    child.on('exit', (code, signal) => {
      children.delete(svc.name);
      if (!estado.apagando) {
        console.error(
          `[start-all] ${svc.name} finalizó (código=${code}, señal=${signal || 'ninguna'}).`,
        );
      }
    });
  });

  const gatewayEnv = construirEnvGatewayModoUnificado();
  const gatewayChild = iniciarProcesoServicio('api-gateway', gatewayEnv);
  children.set('api-gateway', gatewayChild);

  gatewayChild.on('exit', (code, signal) => {
    children.delete('api-gateway');
    if (estado.apagando) {
      process.exit(0);
    }
    console.error(
      `[start-all] api-gateway finalizó (código=${code}, señal=${signal || 'ninguna'}).`,
    );
    apagarTodos('SIGTERM');
    process.exit(code ?? 1);
  });
}

main();
