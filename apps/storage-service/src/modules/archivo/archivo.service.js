const path = require('path');

const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { ValidationError, NotFoundError } = require('../../core/exceptions');

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif']);
const { MAX_FILE_SIZE } = env;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new ValidationError(
        `Invalid file type. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
      ),
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

class ArchivoService {
  constructor(archivoRepository) {
    this.archivoRepository = archivoRepository;
  }

  async uploadFile(file, metadata) {
    const ext = path.extname(file.originalname).toLowerCase();
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(env.UPLOAD_DIR, fileName);

    const archivo = await this.archivoRepository.create({
      nombreOriginal: file.originalname,
      nombreAlmacenado: fileName,
      ruta: filePath,
      tipo: file.mimetype,
      tamano: file.size,
      extension: ext,
      entidadAsociada: metadata?.entidadAsociada || null,
      uuidAsociado: metadata?.uuidAsociado || null,
      usuarioId: metadata?.usuarioId || null,
      usuarioNombre: metadata?.usuarioNombre || null,
      carpeta: metadata?.carpeta || 'general',
      publico: metadata?.publico || false,
    });

    // Indexar metadata en ES
    try {
      await esClient.index({
        index: env.STORAGE_INDEX,
        id: archivo.uuid,
        document: {
          id: archivo.id,
          uuid: archivo.uuid,
          nombre_original: archivo.nombre_original,
          nombre_sistema: archivo.nombre_sistema,
          ruta_acceso: archivo.ruta_acceso,
          mime_type: archivo.mime_type,
          peso_bytes: archivo.peso_bytes,
          entidad_asociada: archivo.entidad_asociada,
          uuid_asociado: archivo.uuid_asociado,
          subido_por: archivo.subido_por,
          subido_por_nombre: archivo.subido_por_nombre,
          extension: archivo.extension,
          carpeta: archivo.carpeta,
          publico: Boolean(archivo.publico),
          activo: Boolean(archivo.activo),
          createdAt: archivo.createdAt,
          updatedAt: archivo.updatedAt,
        },
      });
    } catch (error) {
      logger.warn('Failed to index file in Elasticsearch', {
        fileId: archivo.id,
        error: error.message,
      });
    }

    return archivo;
  }

  async getFileById(id) {
    const archivo = await this.archivoRepository.findById(id);
    if (!archivo) {
      throw new NotFoundError('Archivo no encontrado');
    }
    return archivo;
  }

  async getFileByUuid(uuid) {
    const archivo = await this.archivoRepository.findByUuid(uuid);
    if (!archivo) {
      throw new NotFoundError('Archivo no encontrado');
    }
    return archivo;
  }

  async listFiles({
    page = 1, limit = 20, usuarioId, tipo, entidad, activo,
  }) {
    return this.archivoRepository.findAll({
      page, limit, usuarioId, tipo, entidad, activo,
    });
  }

  async updateFile(id, data) {
    const archivo = await this.archivoRepository.update(id, data);

    // Actualizar en ES
    try {
      await esClient.update({
        index: env.STORAGE_INDEX,
        id: archivo.uuid,
        doc: {
          nombre_original: archivo.nombre_original,
          entidad_asociada: archivo.entidad_asociada,
          uuid_asociado: archivo.uuid_asociado,
          carpeta: archivo.carpeta,
          publico: Boolean(archivo.publico),
          activo: Boolean(archivo.activo),
          updatedAt: archivo.updatedAt,
        },
      });
    } catch (error) {
      logger.warn('Failed to update file in Elasticsearch', {
        fileId: archivo.id,
        error: error.message,
      });
    }

    return archivo;
  }

  async deleteFile(id) {
    const archivo = await this.getFileById(id);
    await this.archivoRepository.delete(id);

    // Eliminar de ES
    try {
      await esClient.delete({
        index: env.STORAGE_INDEX,
        id: archivo.uuid,
      });
    } catch (error) {
      logger.warn('Failed to delete file from Elasticsearch', {
        fileId: archivo.id,
        error: error.message,
      });
    }

    return { success: true };
  }

  async searchFiles(query) {
    return this.archivoRepository.searchInElasticsearch(query);
  }
}

module.exports = {
  ArchivoService, upload, fileFilter, ALLOWED_EXTENSIONS,
};
