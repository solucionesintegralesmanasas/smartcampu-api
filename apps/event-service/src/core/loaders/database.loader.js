const { verifyMysqlConnection } = require('../../config/database/mysql');
const logger = require('../../config/logger');

/**
 * Loader de almacenamiento: verifica la conexión a MySQL al iniciar el servidor.
 * Si no responde en el intento inicial, emite advertencia y permite el arranque.
 */
const databaseLoader = async () => {
  try {
    await verifyMysqlConnection(1, 1000);
    logger.info('Base de datos uajs_events verificada');
  } catch (error) {
    logger.warn('Ping inicial a MySQL (uajs_events) falló (no fatal en arranque)', {
      error: error.message,
    });
  }
};

module.exports = databaseLoader;
