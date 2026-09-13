const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

/**
 * Productor de trabajos para el módulo de almacenamiento.
 */
class StorageProducer {
  constructor() {
    this.queue = createQueue(env.STORAGE_QUEUE);
  }

  /**
   * Añade un trabajo para indexar un archivo en Elasticsearch.
   * @param {object} fileData - Datos del archivo a indexar.
   */
  async indexFile(fileData) {
    await this.queue.add(
      'index_file',
      {
        ...fileData,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  /**
   * Añade un trabajo para actualizar un archivo en Elasticsearch.
   * @param {object} fileData - Datos del archivo a actualizar.
   */
  async updateFileInES(fileData) {
    await this.queue.add(
      'update_file',
      {
        ...fileData,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  /**
   * Añade un trabajo para eliminar un archivo de Elasticsearch.
   * @param {string} fileUuid - UUID del archivo a eliminar.
   */
  async deleteFileFromES(fileUuid) {
    await this.queue.add(
      'delete_file',
      {
        uuid: fileUuid,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }

  /**
   * Añade un trabajo para procesar archivos en lote.
   * @param {Array<object>} files - Array de archivos a procesar.
   */
  async bulkProcessFiles(files) {
    await this.queue.add(
      'bulk_process',
      {
        files,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  }
}

module.exports = StorageProducer;
