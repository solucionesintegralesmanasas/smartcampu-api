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

const ensureEventIndex = async () => {
  try {
    const exists = await esClient.client.indices.exists({ index: env.EVENT_INDEX });
    if (!exists.body) {
      await esClient.client.indices.create({
        index: env.EVENT_INDEX,
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
              title: { type: 'text', analyzer: 'spanish' },
              organizerUuid: { type: 'keyword' },
              campusUuid: { type: 'keyword' },
              estado: { type: 'keyword' },
              startsAt: { type: 'date' },
              endsAt: { type: 'date' },
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

module.exports = { esClient, ensureEventIndex };
