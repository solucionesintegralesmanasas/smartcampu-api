#!/usr/bin/env node

/**
 * Script de setup de Elasticsearch para UAJS Smart Campus
 *
 * Uso:
 *   node scripts/elasticsearch/setup.js          # Crear todos los índices
 *   node scripts/elasticsearch/setup.js --status  # Ver estado de índices
 *   node scripts/elasticsearch/setup.js --delete  # Eliminar todos los índices
 */

const {
  createElasticsearchClient,
  createIndex,
  pingElasticsearch,
  USER_INDEX,
  EVENT_INDEX,
  RESOURCE_INDEX,
  BOOKING_INDEX,
  CATALOG_INDEX,
  UNIVERSITY_INDEX,
  REQUEST_INDEX,
  NOTIFICATION_INDEX,
  PQRS_INDEX,
  STORAGE_INDEX,
  AUTH_INDEX,
  GATEWAY_INDEX,
  mappings,
} = require('@uajs/shared-elasticsearch');

const client = createElasticsearchClient({
  host: process.env.ELASTICSEARCH_HOST || 'localhost',
  port: process.env.ELASTICSEARCH_PORT || '9200',
  user: process.env.ELASTICSEARCH_USER || 'elastic',
  password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
});

const INDICES = [
  { name: USER_INDEX, mapping: mappings.user, description: 'Usuarios' },
  { name: EVENT_INDEX, mapping: mappings.event, description: 'Eventos' },
  { name: RESOURCE_INDEX, mapping: mappings.resource, description: 'Recursos' },
  { name: BOOKING_INDEX, mapping: mappings.booking, description: 'Reservas' },
  { name: CATALOG_INDEX, mapping: mappings.catalog, description: 'Catálogos' },
  { name: UNIVERSITY_INDEX, mapping: mappings.university, description: 'Universidad' },
  { name: REQUEST_INDEX, mapping: mappings.request, description: 'Solicitudes' },
  { name: NOTIFICATION_INDEX, mapping: mappings.notification, description: 'Notificaciones' },
  { name: PQRS_INDEX, mapping: mappings.pqrs, description: 'PQRS' },
  { name: STORAGE_INDEX, mapping: mappings.storage, description: 'Archivos' },
  { name: AUTH_INDEX, mapping: mappings.auth, description: 'Auth Logs' },
  { name: GATEWAY_INDEX, mapping: mappings.gateway, description: 'Gateway Logs' },
];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}i${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}!${colors.reset} ${msg}`),
};

async function setup() {
  log.info('Verificando conexión a Elasticsearch...');

  const isUp = await pingElasticsearch(client);
  if (!isUp) {
    log.error('No se pudo conectar a Elasticsearch. Verifica que esté corriendo.');
    process.exit(1);
  }
  log.success('Conectado a Elasticsearch');

  log.info(`Creando ${INDICES.length} índices...`);

  for (const { name, mapping, description } of INDICES) {
    const created = await createIndex(client, name, mapping);
    if (created) {
      log.success(`${description} (${name}) — creado`);
    } else {
      log.warn(`${description} (${name}) — ya existe`);
    }
  }

  log.success('Setup de Elasticsearch completado');
}

async function status() {
  log.info('Estado de índices:');

  const result = await client.cat.indices({
    format: 'json',
    h: 'index,health,docs.count,store.size',
  });

  const indices = result.filter((idx) => idx.index.startsWith('uajs_'));

  if (indices.length === 0) {
    log.warn('No se encontraron índices de UAJS');
    return;
  }

  console.log('');
  console.log(`${'Índice'.padEnd(35)} ${'Estado'.padEnd(10)} ${'Docs'.padEnd(10)} ${'Tamaño'}`);
  console.log('-'.repeat(70));

  for (const idx of indices) {
    console.log(
      `${idx.index.padEnd(35)} ${(idx.health || 'unknown').padEnd(10)} ${(idx['docs.count'] || '0').padEnd(10)} ${idx['store.size'] || '0b'}`,
    );
  }
  console.log('');
}

async function deleteAll() {
  log.warn('Eliminando todos los índices de UAJS...');

  for (const { name } of INDICES) {
    try {
      const exists = await client.indices.exists({ index: name });
      if (exists) {
        await client.indices.delete({ index: name });
        log.success(`${name} eliminado`);
      }
    } catch (error) {
      log.error(`Error eliminando ${name}: ${error.message}`);
    }
  }

  log.success('Limpieza completada');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';

  try {
    switch (command) {
      case 'setup':
        await setup();
        break;
      case 'status':
        await status();
        break;
      case 'delete':
        await deleteAll();
        break;
      default:
        log.error(`Comando desconocido: ${command}`);
        log.info('Uso: node setup.js [setup|status|delete]');
        process.exit(1);
    }
  } catch (error) {
    log.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { setup, status, deleteAll };
