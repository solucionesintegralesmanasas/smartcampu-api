/**
 * Controlador de archivos.
 */
class ArchivoController {
  /**
   * @param {import('./archivo.service')} archivoService - Servicio de archivos.
   */
  constructor(archivoService) {
    this.archivoService = archivoService;
  }

  /**
   * Sube un archivo.
   */
  async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se proporcionó ningún archivo' });
      }

      const metadata = {
        entidadAsociada: req.body.entidadAsociada || null,
        uuidAsociado: req.body.uuidAsociado || null,
        usuarioId: req.body.usuarioId || (req.user?.id || null),
        usuarioNombre: req.body.usuarioNombre || (req.user?.nombre || null),
        carpeta: req.body.carpeta || 'general',
        publico: req.body.publico === 'true' || req.body.publico === true,
      };

      const archivo = await this.archivoService.uploadFile(req.file, metadata);
      res.status(201).json({ success: true, data: archivo });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtiene un archivo por ID.
   */
  async getFileById(req, res, next) {
    try {
      const { id } = req.params;
      const archivo = await this.archivoService.getFileById(parseInt(id, 10));
      res.status(200).json({ success: true, data: archivo });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtiene un archivo por UUID.
   */
  async getFileByUuid(req, res, next) {
    try {
      const { uuid } = req.params;
      const archivo = await this.archivoService.getFileByUuid(uuid);
      res.status(200).json({ success: true, data: archivo });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista archivos con paginación y filtros.
   */
  async listFiles(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const usuarioId = req.query.usuarioId ? parseInt(req.query.usuarioId, 10) : null;
      const tipo = req.query.tipo || null;
      const entidad = req.query.entidad || null;
      const activo = req.query.activo !== undefined ? req.query.activo === 'true' : undefined;

      const result = await this.archivoService.listFiles({
        page, limit, usuarioId, tipo, entidad, activo,
      });

      res.status(200).json({
        success: true,
        data: result.files,
        meta: {
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit),
            hasNextPage: page < Math.ceil(result.total / limit),
            hasPrevPage: page > 1,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Actualiza metadata de un archivo.
   */
  async updateFile(req, res, next) {
    try {
      const { id } = req.params;
      const data = {
        nombreOriginal: req.body.nombreOriginal,
        entidadAsociada: req.body.entidadAsociada,
        uuidAsociado: req.body.uuidAsociado,
        carpeta: req.body.carpeta,
        publico: req.body.publico,
        activo: req.body.activo,
      };

      const archivo = await this.archivoService.updateFile(parseInt(id, 10), data);
      res.status(200).json({ success: true, data: archivo });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Elimina un archivo (soft delete).
   */
  async deleteFile(req, res, next) {
    try {
      const { id } = req.params;
      const result = await this.archivoService.deleteFile(parseInt(id, 10));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Busca archivos en Elasticsearch.
   */
  async searchFiles(req, res, next) {
    try {
      const query = {
        search: req.query.q || req.query.search || '',
        usuarioId: req.query.usuarioId ? parseInt(req.query.usuarioId, 10) : null,
        tipo: req.query.tipo || null,
        entidad: req.query.entidad || null,
        activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined,
        offset: parseInt(req.query.offset, 10) || 0,
        limit: parseInt(req.query.limit, 10) || 20,
      };

      if (!query.search) {
        return res.status(400).json({ success: false, message: 'El parámetro de búsqueda es requerido' });
      }

      const result = await this.archivoService.searchFiles(query);

      res.status(200).json({
        success: true,
        data: result.files,
        meta: {
          pagination: {
            total: result.total,
            limit: query.limit,
            offset: query.offset,
            hasNextPage: query.offset + query.limit < result.total,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ArchivoController;
