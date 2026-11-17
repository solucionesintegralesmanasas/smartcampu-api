const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

class NotificationProducer {
  constructor() {
    this.queue = createQueue(env.NOTIFICATION_QUEUE);
  }

  async addNotificationEvent(eventType, data) {
    await this.queue.add(
      'log_notification_event',
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

module.exports = NotificationProducer;
