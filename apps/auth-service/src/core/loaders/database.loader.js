const { ensureAuthEventsIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureAuthEventsIndex();
    logger.info('Elasticsearch auth events index initialized');
  } catch (error) {
    logger.warn('Elasticsearch auth events index init failed (non-fatal)', {
      error: error.message,
    });
  }
};

module.exports = databaseLoader;
