#!/usr/bin/env node

/**
 * Script para inicializar índices y sincronizar catálogos de MySQL a Elasticsearch
 *
 * Uso:
 *   node scripts/elasticsearch/sync-catalogs.js
 */

const { createElasticsearchClient } = require('@uajs/shared-elasticsearch');
const mysql = require('mysql2/promise');

const esClient = createElasticsearchClient({
  host: process.env.ELASTICSEARCH_HOST || 'localhost',
  port: process.env.ELASTICSEARCH_PORT || '9200',
  user: process.env.ELASTICSEARCH_USER || 'elastic',
  password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
});

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'uajs_user',
  password: process.env.MYSQL_PASSWORD || 'uajs206**',
  database: 'uajs_catalog',
};

async function ensureIndices() {
  const indices = [
    {
      name: 'departments',
      body: {
        mappings: {
          properties: {
            id: { type: 'integer' },
            uuid: { type: 'keyword' },
            name: { type: 'text', analyzer: 'spanish', fields: { keyword: { type: 'keyword' } } },
            daneCode: { type: 'keyword' },
            countryId: { type: 'integer' },
            active: { type: 'boolean' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    },
    {
      name: 'cities',
      body: {
        mappings: {
          properties: {
            id: { type: 'integer' },
            uuid: { type: 'keyword' },
            name: { type: 'text', analyzer: 'spanish', fields: { keyword: { type: 'keyword' } } },
            daneCode: { type: 'keyword' },
            stateId: { type: 'integer' },
            active: { type: 'boolean' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    },
    {
      name: 'campuses',
      body: {
        mappings: {
          properties: {
            id: { type: 'integer' },
            uuid: { type: 'keyword' },
            name: { type: 'text', analyzer: 'spanish', fields: { keyword: { type: 'keyword' } } },
            address: { type: 'text' },
            phone: { type: 'keyword' },
            cityId: { type: 'integer' },
            active: { type: 'boolean' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    },
    {
      name: 'document-types',
      body: {
        mappings: {
          properties: {
            id: { type: 'integer' },
            uuid: { type: 'keyword' },
            name: { type: 'text', analyzer: 'spanish', fields: { keyword: { type: 'keyword' } } },
            code: { type: 'keyword' },
            requiresCheckDigit: { type: 'boolean' },
            active: { type: 'boolean' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    },
  ];

  for (const idx of indices) {
    const exists = await esClient.client.indices.exists({ index: idx.name });
    const isPresent = typeof exists === 'boolean' ? exists : exists.body;
    if (isPresent && idx.name === 'cities') {
      // Recrear índice cities si existía previamente con esquema antiguo
      await esClient.client.indices.delete({ index: 'cities' });
      await esClient.client.indices.create({ index: idx.name, body: idx.body });
      console.log(`[ES] Índice '${idx.name}' recreado con mapping actualizado`);
    } else if (!isPresent) {
      await esClient.client.indices.create({ index: idx.name, body: idx.body });
      console.log(`[ES] Índice '${idx.name}' creado`);
    } else {
      console.log(`[ES] Índice '${idx.name}' ya existe`);
    }
  }
}

async function syncCatalogs() {
  console.log('Conectando a MySQL uajs_catalog...');
  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    await ensureIndices();

    // 1. Departamentos
    const [departments] = await conn.query('SELECT * FROM departments WHERE is_active = 1');
    console.log(`Sincronizando ${departments.length} departamentos...`);
    for (const d of departments) {
      await esClient.index({
        index: 'departments',
        id: String(d.id),
        document: {
          id: d.id,
          uuid: d.uuid,
          name: d.name,
          daneCode: d.dane_code,
          countryId: d.country_id,
          active: Boolean(d.is_active),
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        },
      });
    }

    // 2. Ciudades
    const [cities] = await conn.query('SELECT * FROM cities WHERE is_active = 1');
    console.log(`Sincronizando ${cities.length} ciudades...`);
    for (const c of cities) {
      await esClient.index({
        index: 'cities',
        id: String(c.id),
        document: {
          id: c.id,
          uuid: c.uuid,
          name: c.name,
          daneCode: c.dane_code,
          stateId: c.state_id,
          active: Boolean(c.is_active),
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        },
      });
    }

    // 3. Sedes (campuses)
    const [campuses] = await conn.query('SELECT * FROM campuses WHERE is_active = 1');
    console.log(`Sincronizando ${campuses.length} sedes/campuses...`);
    for (const cp of campuses) {
      await esClient.index({
        index: 'campuses',
        id: String(cp.id),
        document: {
          id: cp.id,
          uuid: cp.uuid,
          name: cp.name,
          address: cp.address,
          phone: cp.phone,
          cityId: cp.city_id,
          active: Boolean(cp.is_active),
          createdAt: cp.created_at,
          updatedAt: cp.updated_at,
        },
      });
    }

    // 4. Tipos de Documento
    const [docTypes] = await conn.query('SELECT * FROM document_types WHERE is_active = 1');
    console.log(`Sincronizando ${docTypes.length} tipos de documento...`);
    for (const dt of docTypes) {
      await esClient.index({
        index: 'document-types',
        id: String(dt.id),
        document: {
          id: dt.id,
          uuid: dt.uuid,
          name: dt.name,
          code: dt.code,
          requiresCheckDigit: Boolean(dt.requires_check_digit),
          active: Boolean(dt.is_active),
          createdAt: dt.created_at,
          updatedAt: dt.updated_at,
        },
      });
    }

    // Forzar refresh de índices
    await esClient.client.indices.refresh({
      index: ['departments', 'cities', 'campuses', 'document-types'],
    });
    console.log('¡Sincronización completada exitosamente!');
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  syncCatalogs()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error sincronizando catálogos:', err);
      process.exit(1);
    });
}

module.exports = { syncCatalogs, ensureIndices };
