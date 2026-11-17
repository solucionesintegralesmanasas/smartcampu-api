const { createRedisClient, pingRedis } = require('@uajs/database-client');

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

/**
 * Comprueba Redis sin lanzar errores (la disponibilidad de Redis no es fatal).
 * @returns {Promise<boolean>}
 */
const pingRedisSeguro = async () => {
  try {
    await pingRedis(getRedisClient());
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = { getRedisClient, pingRedisSeguro };
