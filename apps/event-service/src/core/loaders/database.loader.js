const { verifyMysqlConnection } = require('../../config/database/mysql');
const logger = require('../../config/logger');

/**
 * Loader de almacenamiento: verifica la conexión a MySQL antes de iniciar el servidor.
 * Si la base de datos no responde tras los reintentos, el arranque falla.
 */
const databaseLoader = async () => {
  await verifyMysqlConnection();
  logger.info('Base de datos uajs_events verificada');
};

module.exports = databaseLoader;
