const logger = require('../../config/logger');

/**
 * Lee una clave de Redis tolerando fallos: si Redis está caído o el circuit
 * breaker está abierto, se trata como un cache-miss (null) en vez de
 * propagar el error y tumbar un GET que MySQL sí podría responder.
 */
async function safeCacheGet(redisClient, key) {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.warn('Fallo leyendo caché, se continúa sin ella', { key, error: error.message });
    return null;
  }
}

/**
 * Escribe una clave de Redis tolerando fallos: si Redis no responde, la
 * escritura en la base de datos que ya ocurrió no debe fallar por esto.
 */
async function safeCacheSet(redisClient, key, value, ttl) {
  try {
    await redisClient.set(key, JSON.stringify(value), ttl);
  } catch (error) {
    logger.warn('Fallo escribiendo caché, se continúa sin ella', { key, error: error.message });
  }
}

/**
 * Invalida una lista de claves tolerando fallos por clave individual, para
 * que un error de Redis durante la invalidación no convierta una escritura
 * ya exitosa en MySQL en un 500 para el cliente.
 */
async function safeCacheInvalidate(redisClient, keys) {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await redisClient.del(key);
      } catch (error) {
        logger.warn('Fallo invalidando clave de caché', { key, error: error.message });
      }
    }),
  );
}

module.exports = { safeCacheGet, safeCacheSet, safeCacheInvalidate };
