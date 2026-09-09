const { ensureCatalogIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureCatalogIndex();
    logger.info('Elasticsearch catalog index initialized');
  } catch (error) {
    logger.warn('Elasticsearch catalog index init failed (non-fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
