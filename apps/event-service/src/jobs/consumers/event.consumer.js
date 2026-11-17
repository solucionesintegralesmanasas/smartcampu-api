const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class EventConsumer {
  constructor() {
    this.worker = createWorker(env.EVENT_QUEUE, async (job) => {
      if (job.name === 'log_event_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.EVENT_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'event-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing event-service event', { error: error.message });
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

module.exports = EventConsumer;
