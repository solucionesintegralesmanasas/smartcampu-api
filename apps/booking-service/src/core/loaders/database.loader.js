const { esClient } = require('../../config/elasticsearch');
const { getMysqlPool } = require('../../config/database/mysql');
const { pingRedisSeguro } = require('../../config/database/redis');
const logger = require('../../config/logger');

/**
 * Verifica las dependencias al arrancar. MySQL es obligatorio; Redis y
 * Elasticsearch solo generan advertencias.
 */
const databaseLoader = async () => {
  const mysqlDisponible = await getMysqlPool().ping();
  if (!mysqlDisponible) {
    throw new Error('No se pudo conectar a MySQL (uajs_bookings)');
  }
  logger.info('Conexión a MySQL verificada');

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
