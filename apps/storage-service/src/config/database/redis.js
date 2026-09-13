// eslint-disable-next-line import/no-extraneous-dependencies
const { createRedisClient } = require('@uajs/database-client');

const { env } = require('../env');

let client = null;

const getRedisClient = () => {
  if (!client) {
    client = createRedisClient({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      commandTimeout: 5000,
      maxRetriesPerRequest: 3,
    });
  }
  return client;
};

module.exports = { getRedisClient };
