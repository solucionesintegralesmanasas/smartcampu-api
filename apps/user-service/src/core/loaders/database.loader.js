const { ensureUserIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureUserIndex();
    logger.info('Elasticsearch user index initialized');
  } catch (error) {
    logger.warn('Elasticsearch user index init failed (non-fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
