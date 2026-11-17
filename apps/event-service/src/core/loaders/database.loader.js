const { ensureEventIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureEventIndex();
    logger.info('Elasticsearch event index initialized');
  } catch (error) {
    logger.warn('Elasticsearch event index init failed (non-fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
