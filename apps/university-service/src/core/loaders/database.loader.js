const { getMysqlPool } = require('../../config/database/mysql');
const { ensureUniversityIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

/**
 * Loader para inicialización de almacenamiento y esquemas (Elasticsearch y MySQL).
 */
const databaseLoader = async () => {
  try {
    await ensureUniversityIndex();
    logger.info('Índice de Elasticsearch uajs_university inicializado correctamente');
  } catch (error) {
    logger.warn('Inicialización de índice uajs_university en Elasticsearch no fatal', {
      error: error.message,
    });
  }

  try {
    const pool = getMysqlPool();
    await pool.ping();
    logger.info('Conexión a base de datos MySQL verificada');
  } catch (error) {
    logger.warn('Ping inicial a base de datos MySQL falló (no fatal en arranque)', {
      error: error.message,
    });
  }
};

module.exports = databaseLoader;
