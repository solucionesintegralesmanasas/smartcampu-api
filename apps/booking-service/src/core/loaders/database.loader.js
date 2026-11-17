const { ensureBookingIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureBookingIndex();
    logger.info('Elasticsearch booking index initialized');
  } catch (error) {
    logger.warn('Elasticsearch booking index init failed (non-fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
