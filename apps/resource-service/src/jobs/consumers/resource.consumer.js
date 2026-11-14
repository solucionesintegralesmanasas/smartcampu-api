const { RESOURCE_INDEX } = require('@uajs/shared-elasticsearch');

const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

/**
 * Aplica una operación de sincronización sobre el índice de recursos.
 * @param {{ action: string, payload: object }} data
 */
const syncResourceIndex = async ({ action, payload }) => {
  const params = { index: RESOURCE_INDEX, id: `resource_${payload.id}` };
  if (action === 'delete') {
    await esClient.delete(params);
    return;
  }
  await esClient.index({ ...params, body: payload });
};

/**
 * Trabajador BullMQ que mantiene el índice de Elasticsearch de recursos.
 */
class ResourceConsumer {
  constructor() {
    this.worker = createWorker(env.RESOURCE_QUEUE, async (job) => {
      if (job.name !== 'sync_resource') {
        return { skipped: true };
      }
      try {
        await syncResourceIndex(job.data);
        return { success: true };
      } catch (error) {
        logger.error('Error sincronizando recurso con Elasticsearch', {
          jobId: job.id,
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

module.exports = ResourceConsumer;
