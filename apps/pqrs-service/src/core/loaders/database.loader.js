const { ensurePqrsIndex } = require('../../config/elasticsearch');
const logger = require('../../config/logger');

const databaseLoader = async () => {
  try {
    await ensurePqrsIndex();
    logger.info('Elasticsearch pqrs index initialized');
  } catch (error) {
    logger.warn('Elasticsearch pqrs index init failed (non-fatal)', { error: error.message });
  }
};

module.exports = databaseLoader;
