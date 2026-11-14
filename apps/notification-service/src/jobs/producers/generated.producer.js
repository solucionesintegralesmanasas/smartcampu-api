// eslint-disable-next-line import/no-extraneous-dependencies
const { createEventEnvelope, EVENT_QUEUES, EVENT_TYPES } = require('@uajs/shared-types');

const { createQueue } = require('../../config/queues');

const SERVICE_NAME = 'notification-service';

/**
 * Publica NotificacionGeneradaEvent para que otros servicios (correo, auditoría) reaccionen.
 */
class GeneratedProducer {
  constructor() {
    this.queue = null;
  }

  getQueue() {
    if (!this.queue) {
      this.queue = createQueue(EVENT_QUEUES[EVENT_TYPES.NOTIFICACION_GENERADA]);
    }
    return this.queue;
  }

  /**
   * @param {object} payload - Según el JSDoc de NotificacionGeneradaEvent.
   * @returns {Promise<object>} Envelope publicado.
   */
  async publish(payload) {
    const envelope = createEventEnvelope({
      eventType: EVENT_TYPES.NOTIFICACION_GENERADA,
      source: SERVICE_NAME,
      payload,
    });
    await this.getQueue().add(EVENT_TYPES.NOTIFICACION_GENERADA, envelope, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    return envelope;
  }
}

module.exports = GeneratedProducer;
