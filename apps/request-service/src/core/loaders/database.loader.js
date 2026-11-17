const { ensureRequestIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureRequestIndex();
    logger.info('Elasticsearch request index initialized');
  } catch (error) {
    logger.warn('Elasticsearch request index init failed (non-fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
