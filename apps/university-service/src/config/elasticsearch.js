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

const ensureUniversityIndex = async () => {
  try {
    const exists = await esClient.client.indices.exists({ index: env.UNIVERSITY_INDEX });
    if (!exists.body) {
      await esClient.client.indices.create({
        index: env.UNIVERSITY_INDEX,
        body: {
          settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
          },
          mappings: {
            dynamic: 'strict',
            properties: {
              type: { type: 'keyword' },
              id: { type: 'integer' },
              nombre: { type: 'text', analyzer: 'spanish' },
              codigo: { type: 'keyword' },
              estado: { type: 'keyword' },
              parent: {
                properties: {
                  id: { type: 'integer' },
                  type: { type: 'keyword' },
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
    // El índice se crea de forma no bloqueante
  }
};

module.exports = { esClient, ensureUniversityIndex };
