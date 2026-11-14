const { env } = require('../../config/env');
const { ENTREGA } = require('../../core/constants/notification.constants');
const { createQueue } = require('../../config/queues');

/**
 * Encola la entrega de una notificación (correo o push) en la cola de entregas.
 */
class DeliveryProducer {
  constructor() {
    this.queue = null;
  }

  getQueue() {
    if (!this.queue) {
      this.queue = createQueue(env.NOTIFICATION_DELIVERY_QUEUE);
    }
    return this.queue;
  }

  /**
   * @param {string} notificationUuid
   */
  async addDelivery(notificationUuid) {
    await this.getQueue().add(
      'deliver',
      { notificationUuid },
      {
        attempts: ENTREGA.INTENTOS,
        backoff: { type: 'exponential', delay: ENTREGA.BACKOFF_MS },
        removeOnComplete: 200,
        removeOnFail: 1000,
      },
    );
  }
}

module.exports = DeliveryProducer;
