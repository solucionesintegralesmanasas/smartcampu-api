const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class StorageProducer {
  constructor() {
    this.queue = createQueue(env.STORAGE_QUEUE);
  }

  async addStorageEvent(eventType, data) {
    await this.queue.add(
      'log_storage_event',
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

module.exports = StorageProducer;
