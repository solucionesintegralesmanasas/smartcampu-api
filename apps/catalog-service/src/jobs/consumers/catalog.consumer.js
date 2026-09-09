const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class CatalogConsumer {
  constructor() {
    this.worker = createWorker(env.CATALOG_QUEUE, async (job) => {
      if (job.name === 'log_catalog_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.CATALOG_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'catalog-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing catalog event', { error: error.message });
        }
        return { success: true };
      }
    });
  }

  async close() {
    await this.worker.close();
  }
}

module.exports = CatalogConsumer;
