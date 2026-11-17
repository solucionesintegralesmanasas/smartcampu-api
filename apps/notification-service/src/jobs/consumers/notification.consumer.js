const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

const { DomainEventsConsumer } = require('./domain-events.consumer');

class NotificationConsumer {
  constructor(domainEventsConsumer = new DomainEventsConsumer()) {
    this.domainEventsConsumer = domainEventsConsumer;
    this.worker = createWorker(env.NOTIFICATION_QUEUE, async (job) => {
      // Job propio de auditoría (self-log de notification-service).
      if (job.name === 'log_notification_event') {
        const { eventType, ...metadata } = job.data;
        try {
          await esClient.index({
            index: `${env.NOTIFICATION_INDEX}_events`,
            document: {
              '@timestamp': new Date().toISOString(),
              eventType,
              service: 'notification-service',
              ...metadata,
            },
          });
        } catch (error) {
          logger.error('Error indexing notification event', { error: error.message });
        }
        return { success: true };
      }

      // Evento de dominio publicado por booking/request/event/pqrs-service
      // en esta misma cola compartida (ver comentario en config/env.js).
      if (job.name === 'domain_event') {
        const { eventType, ...data } = job.data;
        try {
          return await this.domainEventsConsumer.handle(eventType, data);
        } catch (error) {
          logger.error('Error procesando evento de dominio', {
            eventType, error: error.message,
          });
          throw error;
        }
      }

      return undefined;
    });
  }

  async close() {
    await this.worker.close();
  }
}

module.exports = NotificationConsumer;
