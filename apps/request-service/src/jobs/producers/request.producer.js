const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class RequestProducer {
  constructor() {
    this.queue = createQueue(env.REQUEST_QUEUE);
  }

  async addRequestEvent(eventType, data) {
    await this.queue.add(
      'log_request_event',
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

module.exports = RequestProducer;
