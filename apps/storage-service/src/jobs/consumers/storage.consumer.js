const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');

/**
 * Consumidor de trabajos para el módulo de almacenamiento.
 */
class StorageConsumer {
  constructor() {
    this.worker = createWorker(env.STORAGE_QUEUE, async (job) => {
      try {
        switch (job.name) {
          case 'index_file':
            await this.handleIndexFile(job.data);
            break;
          case 'update_file':
            await this.handleUpdateFile(job.data);
            break;
          case 'delete_file':
            await this.handleDeleteFile(job.data);
            break;
          case 'bulk_process':
            await this.handleBulkProcess(job.data);
            break;
          default:
            logger.warn(`Unknown job type: ${job.name}`);
        }
        return { success: true };
      } catch (error) {
        logger.error(`Error processing job ${job.name}:`, error.message);
        throw error;
      }
    });
  }

  async handleIndexFile(data) {
    const {
      id, uuid, nombre_original, nombre_sistema, ruta_acceso, mime_type, peso_bytes,
      entidad_asociada, uuid_asociado, subido_por, subido_por_nombre, extension,
      carpeta, publico, activo, createdAt, updatedAt,
    } = data;

    await esClient.index({
      index: env.STORAGE_INDEX,
      id: uuid,
      document: {
        id,
        uuid,
        nombre_original,
        nombre_sistema,
        ruta_acceso,
        mime_type,
        peso_bytes,
        entidad_asociada,
        uuid_asociado,
        subido_por,
        subido_por_nombre,
        extension,
        carpeta,
        publico: Boolean(publico),
        activo: Boolean(activo),
        createdAt,
        updatedAt,
      },
    });

    logger.info(`File indexed in Elasticsearch: ${uuid}`);
  }

  async handleUpdateFile(data) {
    const { uuid, ...updateData } = data;

    await esClient.update({
      index: env.STORAGE_INDEX,
      id: uuid,
      doc: updateData,
    });

    logger.info(`File updated in Elasticsearch: ${uuid}`);
  }

  async handleDeleteFile(data) {
    const { uuid } = data;

    await esClient.delete({
      index: env.STORAGE_INDEX,
      id: uuid,
    });

    logger.info(`File deleted from Elasticsearch: ${uuid}`);
  }

  async handleBulkProcess(data) {
    const { files } = data;

    if (!files || !files.length) return;

    const body = files.flatMap((file) => [
      { index: { _index: env.STORAGE_INDEX, _id: file.uuid } },
      {
        id: file.id,
        uuid: file.uuid,
        nombre_original: file.nombre_original,
        nombre_sistema: file.nombre_sistema,
        ruta_acceso: file.ruta_acceso,
        mime_type: file.mime_type,
        peso_bytes: file.peso_bytes,
        entidad_asociada: file.entidad_asociada,
        uuid_asociado: file.uuid_asociado,
        subido_por: file.subido_por,
        subido_por_nombre: file.subido_por_nombre,
        extension: file.extension,
        carpeta: file.carpeta,
        publico: Boolean(file.publico),
        activo: Boolean(file.activo),
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      },
    ]);

    await esClient.bulk({ body });
    logger.info(`Bulk processed ${files.length} files in Elasticsearch`);
  }

  async close() {
    await this.worker.close();
  }
}

module.exports = StorageConsumer;
