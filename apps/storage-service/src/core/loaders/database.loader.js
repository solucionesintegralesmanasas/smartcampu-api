const { ensureStorageIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureStorageIndex();
    logger.info('Elasticsearch storage index initialized');
  } catch (error) {
    logger.warn('Elasticsearch storage index init failed (non-fatal)', {
      error: error.message,
    });
  }
};

module.exports = databaseLoader;
