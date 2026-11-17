const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class UniversityProducer {
  constructor() {
    this.queue = createQueue(env.UNIVERSITY_QUEUE);
  }

  async addUniversityEvent(eventType, data) {
    await this.queue.add(
      'log_university_event',
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

module.exports = UniversityProducer;
