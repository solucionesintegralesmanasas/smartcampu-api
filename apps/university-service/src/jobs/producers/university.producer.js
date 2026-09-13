const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class UniversityProducer {
  constructor() {
    this.queue = createQueue(env.UNIVERSITY_QUEUE || 'university_events');
  }

  async addUniversityEvent(eventType, data) {
    return this.queue.add(
      'log_university_event',
      {
        eventType,
        ...data,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
  }

  async publishEntitySync(entityType, action, entityData) {
    return this.queue.add(
      'sync_university_entity',
      {
        entityType,
        action,
        data: entityData,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
      },
    );
  }

  async close() {
    await this.queue.close();
  }
}

module.exports = UniversityProducer;
