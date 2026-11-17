const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class EventProducer {
  constructor() {
    this.queue = createQueue(env.EVENT_QUEUE);
  }

  async addEventEvent(eventType, data) {
    await this.queue.add(
      'log_event_event',
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

module.exports = EventProducer;
