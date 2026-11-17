const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class UserConsumer {
  constructor() {
    this.worker = createWorker(env.USER_QUEUE, async (job) => {
      if (job.name === 'log_user_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.USER_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'user-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing user event', { error: error.message });
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

module.exports = UserConsumer;
