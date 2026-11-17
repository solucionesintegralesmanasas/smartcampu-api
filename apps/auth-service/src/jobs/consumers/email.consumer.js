const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { sendMail } = require('../../config/mailer');
const { createWorker } = require('../../config/queues');

/**
 * Consumidor de trabajos para la cola de correos electrónicos.
 */
class EmailConsumer {
  constructor() {
    this.worker = createWorker(env.EMAIL_QUEUE, async (job) => {
      if (job.name === 'send_reset_email') {
        const { email, userId, resetToken } = job.data;
        const resetUrl = `${env.PASSWORD_RESET_URL_BASE}?token=${resetToken}`;

        const { delivered } = await sendMail({
          to: email,
          subject: 'Restablece tu contraseña — UAJS Smart Campus',
          text: `Solicitaste restablecer tu contraseña. Usa este enlace (válido por tiempo limitado): ${resetUrl}\n\nSi no fuiste tú, ignora este mensaje.`,
          html: `<p>Solicitaste restablecer tu contraseña.</p><p><a href="${resetUrl}">Haz clic aquí para continuar</a> (enlace válido por tiempo limitado).</p><p>Si no fuiste tú, ignora este mensaje.</p>`,
        });

        try {
          await esClient.index({
            index: env.AUTH_EVENTS_INDEX,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType: 'reset_email_sent',
              service: 'auth-service',
              userId,
              email,
              status: delivered ? 'sent' : 'logged_only',
            },
          });
        } catch (error) {
          logger.error('Error al registrar evento de correo en ES:', error.message);
        }

        return { success: true, delivered };
      }

      return undefined;
    });
  }

  async close() {
    await this.worker.close();
  }
}

module.exports = EmailConsumer;
