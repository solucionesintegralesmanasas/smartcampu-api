const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

/**
 * Productor de trabajos para la cola de correos electrónicos.
 */
class EmailProducer {
  constructor() {
    this.queue = createQueue(env.EMAIL_QUEUE);
  }

  /**
   * Añade un trabajo a la cola de correos.
   * @param {string} type - Tipo de trabajo.
   * @param {object} data - Datos del trabajo.
   */
  async addJob(type, data) {
    await this.queue.add(type, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }
}

module.exports = EmailProducer;
