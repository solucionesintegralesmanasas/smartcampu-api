const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class UserProducer {
  constructor() {
    this.queue = createQueue(env.USER_QUEUE);
  }

  async addUserEvent(eventType, data) {
    await this.queue.add(
      'log_user_event',
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

module.exports = UserProducer;
