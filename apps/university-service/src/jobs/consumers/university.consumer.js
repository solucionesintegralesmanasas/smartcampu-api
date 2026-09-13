const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

class UniversityConsumer {
  constructor() {
    this.worker = createWorker(env.UNIVERSITY_QUEUE || 'university_events', async (job) => {
      try {
        if (job.name === 'log_university_event') {
          const { eventType, ...metadata } = job.data;
          await esClient.client
            .index({
              index: `${env.UNIVERSITY_INDEX}_events`,
              body: {
                '@timestamp': new Date().toISOString(),
                eventType,
                service: 'university-service',
                ...metadata,
              },
            })
            .catch(() => {});
          return { success: true };
        }

        if (job.name === 'sync_university_entity') {
          const { entityType, action, data } = job.data;
          if (action === 'delete') {
            await esClient.client
              .delete({
                index: 'uajs_university',
                id: `${entityType}_${data.id}`,
              })
              .catch(() => {});
          } else {
            await esClient.client
              .index({
                index: 'uajs_university',
                id: `${entityType}_${data.id}`,
                body: {
                  type: entityType,
                  ...data,
                },
              })
              .catch(() => {});
          }
          return { success: true };
        }
      } catch (error) {
        logger.error('Error procesando evento en UniversityConsumer', {
          jobId: job.id,
          jobName: job.name,
          error: error.message,
        });
        throw error;
      }
    });
  }

  async close() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}

module.exports = UniversityConsumer;
