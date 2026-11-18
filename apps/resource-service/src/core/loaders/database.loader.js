const { getMysqlPool } = require('../../config/database/mysql');
const { getRedisClient } = require('../../config/database/redis');
const { ensureResourceIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

/**
 * Verifica MySQL, Redis y el índice de Elasticsearch de forma no fatal en arranque
 * para que el servicio inicie y reintente en la siguiente operación.
 */
const databaseLoader = async () => {
  try {
    const isMysqlUp = await getMysqlPool().ping();
    if (isMysqlUp) {
      logger.info('Conexión a MySQL verificada');
    } else {
      logger.warn('Ping inicial a MySQL (uajs_resources) falló (no fatal en arranque)');
    }
  } catch (error) {
    logger.warn('Ping inicial a MySQL (uajs_resources) falló (no fatal en arranque)', {
      error: error.message,
    });
  }

  try {
    await getRedisClient().ping();
    logger.info('Conexión a Redis verificada');
  } catch (error) {
    logger.warn('Redis no disponible al arrancar (no fatal)', { error: error.message });
  }

  try {
    await ensureResourceIndex();
    logger.info('Índice de recursos en Elasticsearch listo');
  } catch (error) {
    logger.warn('Inicialización del índice de Elasticsearch fallida (no fatal)', {
      error: error.message,
    });
  }
};

module.exports = databaseLoader;
