// eslint-disable-next-line import/no-extraneous-dependencies
const { createRedisClient } = require('@uajs/database-client');

const { env } = require('../env');

let client = null;

/**
 * Obtiene el cliente Redis (creación perezosa) usado para caché de catálogos.
 * @returns {import('@uajs/database-client').RedisClient}
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

/**
 * Cierra el cliente Redis si fue creado.
 */
const closeRedisClient = async () => {
  if (client) {
    await client.close();
    client = null;
  }
};

module.exports = { getRedisClient, closeRedisClient };
