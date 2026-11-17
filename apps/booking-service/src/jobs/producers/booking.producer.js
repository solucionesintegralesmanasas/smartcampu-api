const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class BookingProducer {
  constructor() {
    this.queue = createQueue(env.BOOKING_QUEUE);
  }

  async addBookingEvent(eventType, data) {
    await this.queue.add(
      'log_booking_event',
      {
        eventType,
        ...data,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }
}

module.exports = BookingProducer;
