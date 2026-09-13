// eslint-disable-next-line import/no-extraneous-dependencies
const { createElasticsearchClient } = require('@uajs/shared-elasticsearch');

const { env } = require('./env');

const esClient = createElasticsearchClient({
  host: env.ELASTICSEARCH_HOST,
  port: String(env.ELASTICSEARCH_PORT),
  user: process.env.ELASTICSEARCH_USER || 'elastic',
  password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  maxRetries: 3,
  requestTimeout: 10000,
});

const ensureStorageIndex = async () => {
  try {
    const exists = await esClient.client.indices.exists({ index: env.STORAGE_INDEX });
    const alreadyExists = typeof exists === 'boolean' ? exists : exists.body;
    if (!alreadyExists) {
      await esClient.client.indices.create({
        index: env.STORAGE_INDEX,
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
        },
        mappings: {
          dynamic: 'strict',
          properties: {
            id: { type: 'integer' },
            uuid: { type: 'keyword' },
            nombre_original: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            nombre_sistema: { type: 'keyword' },
            ruta_acceso: { type: 'keyword' },
            mime_type: { type: 'keyword' },
            peso_bytes: { type: 'long' },
            entidad_asociada: { type: 'keyword' },
            uuid_asociado: { type: 'keyword' },
            subido_por: { type: 'integer' },
            subido_por_nombre: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            extension: { type: 'keyword' },
            carpeta: { type: 'keyword' },
            publico: { type: 'boolean' },
            activo: { type: 'boolean' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      });
    }
  } catch (error) {
    // El índice se crea de forma no bloqueante; si falla, se intentará en el próximo arranque.
  }
};

module.exports = { esClient, ensureStorageIndex };
