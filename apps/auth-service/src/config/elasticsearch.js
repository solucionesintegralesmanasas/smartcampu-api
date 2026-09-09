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

const ensureAuthEventsIndex = async () => {
  try {
    const exists = await esClient.client.indices.exists({ index: env.AUTH_EVENTS_INDEX });
    if (!exists.body) {
      await esClient.client.indices.create({
        index: env.AUTH_EVENTS_INDEX,
        body: {
          settings: {
            number_of_shards: 2,
            number_of_replicas: 1,
            index: { lifecycle: { name: 'uajs_events_policy' } },
          },
          mappings: {
            dynamic: 'strict',
            properties: {
              '@timestamp': { type: 'date' },
              eventType: { type: 'keyword' },
              userId: { type: 'keyword' },
              email: { type: 'keyword' },
              ipAddress: { type: 'ip' },
              userAgent: { type: 'text' },
              status: { type: 'keyword' },
              metadata: { type: 'object', enabled: true },
              correlationId: { type: 'keyword' },
            },
          },
        },
      });
    }
  } catch (error) {
    // El índice se crea de forma no bloqueante; si falla, se intentará en el próximo arranque.
  }
};

module.exports = { esClient, ensureAuthEventsIndex };
