const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class UniversityConsumer {
  constructor() {
    this.worker = createWorker(env.UNIVERSITY_QUEUE, async (job) => {
      if (job.name === 'log_university_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.UNIVERSITY_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'university-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing university event', { error: error.message });
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

module.exports = UniversityConsumer;
