const { createQueue } = require('../../config/queues');

/**
 * Productor de trabajos para eventos de autenticación.
 */
class AuthProducer {
  constructor() {
    this.queue = createQueue('auth_events');
  }

  /**
   * Añade un evento de autenticación a la cola.
   * @param {string} eventType - Tipo de evento.
   * @param {object} data - Datos del evento.
   */
  async addAuthEvent(eventType, data) {
    await this.queue.add(
      'log_auth_event',
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

module.exports = AuthProducer;
