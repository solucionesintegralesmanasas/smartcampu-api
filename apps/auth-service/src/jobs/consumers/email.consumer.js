const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

/**
 * Consumidor de trabajos para la cola de correos electrónicos.
 */
class EmailConsumer {
  constructor() {
    this.worker = createWorker(env.EMAIL_QUEUE, async (job) => {
      if (job.name === 'send_reset_email') {
        const { email, userId } = job.data;
        logger.info(`Enviando correo de restablecimiento a ${email}`);

        try {
          await esClient.index({
            index: env.AUTH_EVENTS_INDEX,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType: 'reset_email_sent',
              service: 'auth-service',
              userId,
              email,
              status: 'sent',
            },
          });
        } catch (error) {
          logger.error('Error al registrar evento de correo en ES:', error.message);
        }

        return { success: true };
      }
    });
  }

  async close() {
    await this.worker.close();
  }
}

module.exports = EmailConsumer;
