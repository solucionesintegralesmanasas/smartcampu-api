const { ensureResourceIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureResourceIndex();
    logger.info('Elasticsearch resource index initialized');
  } catch (error) {
    logger.warn('Elasticsearch resource index init failed (non-fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
