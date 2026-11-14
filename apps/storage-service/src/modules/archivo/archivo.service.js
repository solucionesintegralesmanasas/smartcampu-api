const fs = require('fs/promises');
const path = require('path');

const { v4: uuidv4 } = require('uuid');

const { env } = require('../../config/env');
const logger = require('../../config/logger');
const {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} = require('../../core/exceptions');

const { ALLOWED_EXTENSIONS } = require('./archivo.validation');

const PRIVILEGED_ROLES = Object.freeze(['SUPERADMIN', 'ADMIN', 'STAFF']);

const esPrivilegiado = (actor) => Boolean(actor)
  && actor.roles.some((role) => PRIVILEGED_ROLES.includes(role));

const buildScope = (actor) => ({
  usuarioId: actor ? actor.id : null,
  puedeVerTodo: esPrivilegiado(actor),
});

const puedeGestionar = (archivo, actor) => esPrivilegiado(actor)
  || (Boolean(actor) && archivo.subido_por === actor.id);

const puedeLeer = (archivo, actor) => puedeGestionar(archivo, actor)
  || (Boolean(archivo.publico) && Boolean(archivo.activo));

class ArchivoService {
  /**
   * @param {import('./archivo.repository')} archivoRepository - Acceso a MySQL y Elasticsearch.
   * @param {import('../../jobs/producers/storage.producer')} storageProducer - Cola de indexación.
   */
  constructor(archivoRepository, storageProducer) {
    this.archivoRepository = archivoRepository;
    this.storageProducer = storageProducer;
  }

  assertValidFile(file) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new ValidationError(
        `Tipo de archivo no permitido. Extensiones válidas: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }
    if (!file.size) {
      throw new ValidationError('El archivo está vacío');
    }
    if (file.size > env.MAX_FILE_SIZE) {
      throw new ValidationError(
        `El archivo supera el tamaño máximo permitido de ${env.MAX_FILE_SIZE} bytes`,
      );
    }
    return extension;
  }

  /**
   * Encola una operación de Elasticsearch. Un fallo al encolar no afecta la respuesta.
   */
  async encolar(operacion, payload) {
    try {
      await this.storageProducer[operacion](payload);
    } catch (error) {
      logger.warn('No se pudo encolar la sincronización con Elasticsearch', {
        operacion,
        error: error.message,
      });
    }
  }

  async obtenerLegible(uuid, actor) {
    const archivo = await this.archivoRepository.findByUuid(uuid);
    if (!archivo) throw new NotFoundError('Archivo no encontrado');
    if (!puedeLeer(archivo, actor)) {
      throw actor
        ? new ForbiddenError('No tiene permisos para acceder a este archivo')
        : new UnauthorizedError('Token de acceso no proporcionado');
    }
    return archivo;
  }

  async obtenerGestionable(uuid, actor) {
    const archivo = await this.archivoRepository.findByUuid(uuid);
    if (!archivo) throw new NotFoundError('Archivo no encontrado');
    if (!puedeGestionar(archivo, actor)) {
      throw new ForbiddenError('No tiene permisos para modificar este archivo');
    }
    return archivo;
  }

  async uploadFile(file, metadata, actor) {
    const extension = this.assertValidFile(file);
    const nombreSistema = `${uuidv4()}${extension}`;
    const rutaAcceso = path.join(env.UPLOAD_DIR, nombreSistema);

    await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
    await fs.writeFile(rutaAcceso, file.buffer);

    let archivo;
    try {
      archivo = await this.archivoRepository.create({
        nombreOriginal: path.basename(file.originalname).slice(0, 255),
        nombreSistema,
        rutaAcceso,
        mimeType: file.mimetype,
        pesoBytes: file.size,
        extension,
        entidadAsociada: metadata.entidadAsociada || null,
        uuidAsociado: metadata.uuidAsociado || null,
        subidoPor: actor.id,
        subidoPorNombre: actor.nombre ? actor.nombre.slice(0, 120) : null,
        carpeta: metadata.carpeta || 'general',
        publico: Boolean(metadata.publico),
      });
    } catch (error) {
      await fs.unlink(rutaAcceso).catch(() => {});
      throw error;
    }

    await this.encolar('indexFile', archivo);
    return archivo;
  }

  async getFileByUuid(uuid, actor) {
    return this.obtenerLegible(uuid, actor);
  }

  async listFiles(query, actor) {
    return this.archivoRepository.findAll({ ...query, scope: buildScope(actor) });
  }

  /**
   * Busca en Elasticsearch; si el clúster no responde, degrada a una búsqueda en MySQL.
   */
  async searchFiles(query, actor) {
    const scope = buildScope(actor);
    try {
      return await this.archivoRepository.searchInElasticsearch({ ...query, scope });
    } catch (error) {
      logger.warn('Elasticsearch no disponible; búsqueda degradada a MySQL', {
        error: error.message,
      });
      return this.archivoRepository.findAll({ ...query, scope });
    }
  }

  async updateFile(uuid, data, actor) {
    const actual = await this.obtenerGestionable(uuid, actor);
    const archivo = await this.archivoRepository.update(actual.id, data);
    if (!archivo) throw new NotFoundError('Archivo no encontrado');

    await this.encolar('updateFileInES', {
      uuid: archivo.uuid,
      nombre_original: archivo.nombre_original,
      entidad_asociada: archivo.entidad_asociada,
      uuid_asociado: archivo.uuid_asociado,
      carpeta: archivo.carpeta,
      publico: archivo.publico,
      activo: archivo.activo,
      updatedAt: archivo.updatedAt,
    });
    return archivo;
  }

  async deleteFile(uuid, actor) {
    const archivo = await this.obtenerGestionable(uuid, actor);
    const eliminado = await this.archivoRepository.delete(archivo.id);
    if (!eliminado) throw new NotFoundError('Archivo no encontrado');

    await this.encolar('deleteFileFromES', archivo.uuid);
    return { uuid: archivo.uuid };
  }

  /**
   * Resuelve la ruta física para la descarga, validando permisos y existencia en disco.
   */
  async getDownload(uuid, actor) {
    const archivo = await this.obtenerLegible(uuid, actor);
    const ruta = path.resolve(archivo.ruta_acceso);
    try {
      await fs.access(ruta);
    } catch (error) {
      throw new NotFoundError('El archivo físico no está disponible');
    }
    return { ruta, nombre: archivo.nombre_original, mimeType: archivo.mime_type };
  }
}

module.exports = ArchivoService;
