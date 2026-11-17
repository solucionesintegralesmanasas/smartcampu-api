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
    if (!exists.body) {
      await esClient.client.indices.create({
        index: env.STORAGE_INDEX,
        body: {
          settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
          },
          mappings: {
            dynamic: 'strict',
            properties: {
              id: { type: 'integer' },
              uuid: { type: 'keyword' },
              originalName: { type: 'text', analyzer: 'spanish' },
              mimeType: { type: 'keyword' },
              extension: { type: 'keyword' },
              sizeBytes: { type: 'integer' },
              ownerUserUuid: { type: 'keyword' },
              ownerType: { type: 'keyword' },
              ownerReferenceUuid: { type: 'keyword' },
              estado: { type: 'keyword' },
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

module.exports = { esClient, ensureStorageIndex };
