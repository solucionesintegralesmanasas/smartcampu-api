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

const ensureNotificationIndex = async () => {
  try {
    const exists = await esClient.client.indices.exists({ index: env.NOTIFICATION_INDEX });
    if (!exists.body) {
      await esClient.client.indices.create({
        index: env.NOTIFICATION_INDEX,
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
              recipientUuid: { type: 'keyword' },
              channel: { type: 'keyword' },
              subject: { type: 'text', analyzer: 'spanish' },
              sourceService: { type: 'keyword' },
              sourceEntity: { type: 'keyword' },
              status: { type: 'keyword' },
              queuedAt: { type: 'date' },
              readAt: { type: 'date' },
            },
          },
        },
      });
    }
  } catch (error) {
    // El índice se crea de forma no bloqueante
  }
};

module.exports = { esClient, ensureNotificationIndex };
