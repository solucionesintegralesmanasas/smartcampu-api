const { ensureNotificationIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureNotificationIndex();
    logger.info('Elasticsearch notification index initialized');
  } catch (error) {
    logger.warn('Elasticsearch notification index init failed (non-fatal)', {
      error: error.message,
    });
  }
};

module.exports = databaseLoader;
