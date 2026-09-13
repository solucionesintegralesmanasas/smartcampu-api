const { createResilientElasticsearchClient } = require('@uajs/shared-elasticsearch');

const { env } = require('./env');

const esClient = createResilientElasticsearchClient({
  host: env.ELASTICSEARCH_HOST || process.env.ELASTICSEARCH_HOST || 'localhost',
  port: String(env.ELASTICSEARCH_PORT || process.env.ELASTICSEARCH_PORT || 9200),
  user: process.env.ELASTICSEARCH_USER || 'elastic',
  password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
});

/**
 * Garantiza que el índice uajs_university exista con los mappings adecuados.
 */
const ensureUniversityIndex = async () => {
  try {
    const exists = await esClient.client.indices.exists({ index: 'uajs_university' });
    const indexExists = typeof exists === 'boolean' ? exists : (exists?.body ?? false);

    if (!indexExists) {
      await esClient.client.indices.create({
        index: 'uajs_university',
        body: {
          settings: {
            number_of_shards: 3,
            number_of_replicas: 1,
          },
          mappings: {
            dynamic: false,
            properties: {
              type: { type: 'keyword' },
              id: { type: 'integer' },
              uuid: { type: 'keyword' },
              nombre: {
                type: 'text',
                analyzer: 'spanish',
                fields: { keyword: { type: 'keyword' } },
              },
              codigo: { type: 'keyword' },
              estado: { type: 'keyword' },
              numeroDocumento: { type: 'keyword' },
              email: { type: 'keyword' },
              telefono: { type: 'keyword' },
              relaciones: {
                type: 'nested',
                properties: {
                  type: { type: 'keyword' },
                  id: { type: 'integer' },
                  nombre: { type: 'keyword' },
                },
              },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      });
    }
  } catch (error) {
    // Si el índice ya existe o falla de forma transitoria, no bloquea el arranque
  }
};

module.exports = { esClient, ensureUniversityIndex };
