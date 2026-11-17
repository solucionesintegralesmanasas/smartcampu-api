const { ensureUniversityIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensureUniversityIndex();
    logger.info('Elasticsearch university index initialized');
  } catch (error) {
    logger.warn('Elasticsearch university index init failed (non-fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
