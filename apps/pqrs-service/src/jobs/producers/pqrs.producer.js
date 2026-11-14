// eslint-disable-next-line import/no-extraneous-dependencies
const { createEventEnvelope, EVENT_QUEUES } = require('@uajs/shared-types');

const { createQueue } = require('../../config/queues');

const SERVICE_NAME = 'pqrs-service';

/**
 * Productor de eventos de dominio de PQRS (colas BullMQ definidas en @uajs/shared-types).
 */
class PqrsProducer {
  constructor() {
    this.colas = new Map();
  }

  /**
   * Obtiene (o crea de forma perezosa) la cola asociada a un tipo de evento.
   * @param {string} eventType - Constante de EVENT_TYPES.
   * @returns {import('bullmq').Queue}
   */
  obtenerCola(eventType) {
    const nombre = EVENT_QUEUES[eventType];
    if (!nombre) {
      throw new Error(`Tipo de evento sin cola registrada: ${eventType}`);
    }
    if (!this.colas.has(nombre)) {
      this.colas.set(nombre, createQueue(nombre));
    }
    return this.colas.get(nombre);
  }

  /**
   * Publica un evento con el envelope estándar.
   * @param {string} eventType - Constante de EVENT_TYPES.
   * @param {object} payload - Datos del evento según su JSDoc en event.types.js.
   * @returns {Promise<object>} Envelope publicado.
   */
  async publicar(eventType, payload) {
    const envelope = createEventEnvelope({ eventType, source: SERVICE_NAME, payload });
    await this.obtenerCola(eventType).add(eventType, envelope, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    return envelope;
  }
}

module.exports = PqrsProducer;
