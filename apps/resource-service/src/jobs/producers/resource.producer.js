const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class ResourceProducer {
  constructor() {
    this.queue = createQueue(env.RESOURCE_QUEUE);
  }

  async addResourceEvent(eventType, data) {
    await this.queue.add(
      'log_resource_event',
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

module.exports = ResourceProducer;
