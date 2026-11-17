const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class RequestConsumer {
  constructor() {
    this.worker = createWorker(env.REQUEST_QUEUE, async (job) => {
      if (job.name === 'log_request_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.REQUEST_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'request-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing request event', { error: error.message });
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

module.exports = RequestConsumer;
