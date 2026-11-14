const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createQueue } = require('../../config/queues');

/**
 * Productor de trabajos de sincronización con el índice de búsqueda de recursos.
 * Los errores se registran y nunca se propagan al flujo HTTP.
 */
class ResourceProducer {
  constructor() {
    this.queue = createQueue(env.RESOURCE_QUEUE);
  }

  /**
   * Encola una indexación o eliminación en Elasticsearch.
   * @param {'index'|'delete'} action - Acción sobre el índice.
   * @param {object} payload - Documento a indexar o `{ id }` para eliminar.
   */
  async enqueueSync(action, payload) {
    try {
      await this.queue.add(
        'sync_resource',
        { action, payload, timestamp: new Date().toISOString() },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        },
      );
    } catch (error) {
      logger.warn('No se pudo encolar la sincronización de recurso', {
        action,
        error: error.message,
      });
    }
  }
}

module.exports = ResourceProducer;
