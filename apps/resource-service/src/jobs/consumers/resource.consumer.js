const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class ResourceConsumer {
  constructor() {
    this.worker = createWorker(env.RESOURCE_QUEUE, async (job) => {
      if (job.name === 'log_resource_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.RESOURCE_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'resource-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing resource event', { error: error.message });
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

module.exports = ResourceConsumer;
