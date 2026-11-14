const { getMysqlPool } = require('../../config/database/mysql');
const { ensureUsersIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

/**
 * Loader de inicialización de almacenamiento (Elasticsearch y MySQL). No es fatal.
 */
const databaseLoader = async () => {
  try {
    await ensureUsersIndex();
    logger.info('Índice de Elasticsearch de usuarios inicializado');
  } catch (error) {
    logger.warn('Inicialización del índice de usuarios en Elasticsearch no fatal', {
      error: error.message,
    });
  }

  try {
    const pool = getMysqlPool();
    await pool.ping();
    logger.info('Conexión a MySQL (uajs_users) verificada');
  } catch (error) {
    logger.warn('Ping inicial a MySQL falló (no fatal en arranque)', {
      error: error.message,
    });
  }
};

module.exports = databaseLoader;
