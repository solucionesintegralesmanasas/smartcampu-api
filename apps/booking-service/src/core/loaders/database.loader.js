const { getMysqlPool } = require('../../config/database/mysql');
const { pingRedisSeguro } = require('../../config/database/redis');
const { esClient } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

/**
 * Verifica las dependencias al arrancar. Los fallos iniciales en MySQL, Redis o
 * Elasticsearch generan advertencias para no bloquear el arranque del contenedor.
 */
const databaseLoader = async () => {
  try {
    const mysqlDisponible = await getMysqlPool().ping();
    if (mysqlDisponible) {
      logger.info('Conexión a MySQL verificada');
    } else {
      logger.warn('Ping inicial a MySQL (uajs_bookings) falló (no fatal en arranque)');
    }
  } catch (error) {
    logger.warn('Ping inicial a MySQL (uajs_bookings) falló (no fatal en arranque)', {
      error: error.message,
    });
  }

  if (!(await pingRedisSeguro())) {
    logger.warn('Redis no disponible (no fatal)');
  }

  try {
    await esClient.client.ping();
  } catch (error) {
    logger.warn('Elasticsearch no disponible (no fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
