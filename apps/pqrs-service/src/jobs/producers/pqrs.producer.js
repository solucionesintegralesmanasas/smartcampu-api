const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class PqrsProducer {
  constructor() {
    this.queue = createQueue(env.PQRS_QUEUE);
  }

  async addPqrsEvent(eventType, data) {
    await this.queue.add(
      'log_pqrs_event',
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

module.exports = PqrsProducer;
