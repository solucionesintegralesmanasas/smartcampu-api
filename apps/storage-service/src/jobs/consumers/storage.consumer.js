const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class StorageConsumer {
  constructor() {
    this.worker = createWorker(env.STORAGE_QUEUE, async (job) => {
      if (job.name === 'log_storage_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.STORAGE_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'storage-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing storage event', { error: error.message });
        }
        return { success: true };
      }

      return undefined;
    });
  }

  async close() {
    await this.worker.close();
  }
}

module.exports = StorageConsumer;
