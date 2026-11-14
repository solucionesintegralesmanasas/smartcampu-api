// eslint-disable-next-line import/no-extraneous-dependencies
const { createElasticsearchClient } = require('@uajs/shared-elasticsearch');

const { env } = require('./env');

const esClient = createElasticsearchClient({
  host: env.ELASTICSEARCH_HOST,
  port: String(env.ELASTICSEARCH_PORT),
  user: env.ELASTICSEARCH_USER,
  password: env.ELASTICSEARCH_PASSWORD,
  maxRetries: 3,
  requestTimeout: 10000,
});

module.exports = { esClient };
