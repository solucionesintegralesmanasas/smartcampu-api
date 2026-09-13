const { createRedisClient } = require('@uajs/database-client');

const { env } = require('../env');

let client = null;

/**
 * Obtiene o crea una instancia única de cliente Redis.
 * @returns {import('@uajs/database-client').RedisClient} Cliente Redis
 */
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
