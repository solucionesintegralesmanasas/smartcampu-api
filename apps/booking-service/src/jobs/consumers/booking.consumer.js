const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class BookingConsumer {
  constructor() {
    this.worker = createWorker(env.BOOKING_QUEUE, async (job) => {
      if (job.name === 'log_booking_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.BOOKING_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'booking-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing booking event', { error: error.message });
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

module.exports = BookingConsumer;
