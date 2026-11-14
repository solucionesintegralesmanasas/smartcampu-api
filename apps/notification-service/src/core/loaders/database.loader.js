const { ensureNotificationsEventsIndex } = require('../../config/elasticsearch');
const { getMysqlPool } = require('../../config/database/mysql');
const logger = require('../../config/logger');

/**
 * Verifica las dependencias de infraestructura al arrancar. Los fallos no son fatales.
 */
const databaseLoader = async () => {
  try {
    await getMysqlPool().ping();
    logger.info('Conexión a MySQL (uajs_notifications) verificada');
  } catch (error) {
    logger.warn('Ping inicial a MySQL falló (no fatal en arranque)', { error: error.message });
  }

  try {
    await ensureNotificationsEventsIndex();
    logger.info('Índice de eventos de notificación verificado');
  } catch (error) {
    logger.warn('No se pudo verificar el índice de eventos (no fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
