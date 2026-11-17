const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class PqrsConsumer {
  constructor() {
    this.worker = createWorker(env.PQRS_QUEUE, async (job) => {
      if (job.name === 'log_pqrs_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.PQRS_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'pqrs-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing pqrs event', { error: error.message });
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

module.exports = PqrsConsumer;
