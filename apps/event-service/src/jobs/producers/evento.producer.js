// eslint-disable-next-line import/no-extraneous-dependencies
const { createEventEnvelope, EVENT_QUEUES, EVENT_TYPES } = require('@uajs/shared-types');

const { createQueue } = require('../../config/queues');

const SERVICE_NAME = 'event-service';

let producer = null;

/**
 * Publica EventoProgramadoEvent cuando un evento pasa a `published`.
 */
class EventoProducer {
  constructor() {
    this.queue = null;
  }

  getQueue() {
    if (!this.queue) {
      this.queue = createQueue(EVENT_QUEUES[EVENT_TYPES.EVENTO_PROGRAMADO]);
    }
    return this.queue;
  }

  /**
   * @param {object} payload - Según el JSDoc de EventoProgramadoEvent.
   * @returns {Promise<object>} Envelope publicado.
   */
  async publicarEventoProgramado(payload) {
    const envelope = createEventEnvelope({
      eventType: EVENT_TYPES.EVENTO_PROGRAMADO,
      source: SERVICE_NAME,
      payload,
    });
    await this.getQueue().add(EVENT_TYPES.EVENTO_PROGRAMADO, envelope, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    return envelope;
  }
}

/** Instancia perezosa compartida. */
const getEventoProducer = () => {
  if (!producer) {
    producer = new EventoProducer();
  }
  return producer;
};

module.exports = EventoProducer;
module.exports.getEventoProducer = getEventoProducer;
