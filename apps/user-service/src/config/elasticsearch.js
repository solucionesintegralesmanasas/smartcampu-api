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

const ensureUsersIndex = async () => {
  try {
    const exists = await esClient.client.indices.exists({ index: env.USER_INDEX });
    if (!exists.body) {
      await esClient.client.indices.create({
        index: env.USER_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
          },
          mappings: {
            dynamic: 'strict',
            properties: {
              userId: { type: 'keyword' },
              firstName: { type: 'text' },
              lastName: { type: 'text' },
              documentNumber: { type: 'keyword' },
              cityCode: { type: 'keyword' },
              updatedAt: { type: 'date' },
            },
          },
        },
      });
    }
  } catch (error) {
    // El índice se crea de forma no bloqueante; si falla, se intentará en el próximo arranque.
  }
};

module.exports = { esClient, ensureUsersIndex };
