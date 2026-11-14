const { ensureResourceIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');
const { getMysqlPool } = require('../../config/database/mysql');
const { getRedisClient } = require('../../config/database/redis');

/**
 * Verifica MySQL (fatal si no responde) e inicializa Redis y el índice de Elasticsearch
 * (no fatales: el servicio arranca y reintenta en la siguiente operación).
 */
const databaseLoader = async () => {
  const isMysqlUp = await getMysqlPool().ping();
  if (!isMysqlUp) {
    throw new Error('No se pudo conectar a MySQL (uajs_resources)');
  }
  logger.info('Conexión a MySQL verificada');

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
