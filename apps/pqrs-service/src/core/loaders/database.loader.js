// eslint-disable-next-line import/no-extraneous-dependencies
const { pingElasticsearch } = require('@uajs/shared-elasticsearch');

const { esClient } = require('../../config/elasticsearch');
const { getMysqlPool } = require('../../config/database/mysql');
const logger = require('../../config/logger');

/**
 * Verifica las dependencias de infraestructura al arrancar. Los fallos no son fatales:
 * MySQL reintenta en cada consulta y Elasticsearch solo se usa para logs.
 */
const databaseLoader = async () => {
  try {
    await getMysqlPool().ping();
    logger.info('Conexión a MySQL (uajs_pqrs) verificada');
  } catch (error) {
    logger.warn('Ping inicial a MySQL falló (no fatal en arranque)', { error: error.message });
  }

  try {
    const saludable = await pingElasticsearch(esClient);
    logger.info(`Elasticsearch disponible: ${saludable}`);
  } catch (error) {
    logger.warn('Elasticsearch no disponible al arrancar (no fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
