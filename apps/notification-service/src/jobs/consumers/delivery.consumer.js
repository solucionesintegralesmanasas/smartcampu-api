const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

/**
 * Consumidor de la cola de entregas: ejecuta el envío por canal con reintentos.
 * BullMQ reintenta con backoff exponencial; el estado final se refleja en la notificación.
 */
class DeliveryConsumer {
  /**
   * @param {import('../../core/services/notification-dispatcher.service')} dispatcher
   */
  constructor(dispatcher) {
    this.dispatcher = dispatcher;
    this.worker = null;
  }

  start() {
    if (this.worker) {
      return this.worker;
    }
    this.worker = createWorker(
      env.NOTIFICATION_DELIVERY_QUEUE,
      async (job) => this.dispatcher.deliver(job.data.notificationUuid, job.attemptsMade),
      { concurrency: env.NOTIFICATION_WORKER_CONCURRENCY },
    );

    this.worker.on('failed', async (job, err) => {
      logger.warn('Entrega de notificación falló', {
        notificationUuid: job?.data?.notificationUuid,
        attempt: job?.attemptsMade,
        error: err.message,
      });
      const agotado = job && job.attemptsMade >= (job.opts.attempts || env.NOTIFICATION_WORKER_CONCURRENCY);
      if (agotado) {
        await this.dispatcher.markFailed(job.data.notificationUuid, err.message);
      }
    });

    return this.worker;
  }

  async close() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}

module.exports = DeliveryConsumer;
