const { ValidationError } = require('../../core/exceptions');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

/**
 * Quita la ruta física del servidor antes de exponer el registro al cliente.
 */
const toApiArchivo = (archivo) => {
  const { ruta_acceso: rutaAcceso, ...publico } = archivo;
  return publico;
};

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

  async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        throw new ValidationError("Debe adjuntar un archivo en el campo 'archivo'");
      }
      const archivo = await this.archivoService.uploadFile(req.file, req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Archivo subido correctamente',
        data: toApiArchivo(archivo),
      });
    } catch (error) {
      next(error);
    }
  }

  async getFileByUuid(req, res, next) {
    try {
      const archivo = await this.archivoService.getFileByUuid(req.params.uuid, req.user);
      res.status(200).json({ success: true, data: toApiArchivo(archivo) });
    } catch (error) {
      next(error);
    }
  }

  async listFiles(req, res, next) {
    try {
      const { page, limit, ...filtros } = req.query;
      const result = await this.archivoService.listFiles({ page, limit, ...filtros }, req.user);
      res.status(200).json({
        success: true,
        data: result.files.map(toApiArchivo),
        meta: getPaginationMeta(page, limit, result.total),
      });
    } catch (error) {
      next(error);
    }
  }

  async searchFiles(req, res, next) {
    try {
      const { page, limit, ...filtros } = req.query;
      const result = await this.archivoService.searchFiles({ page, limit, ...filtros }, req.user);
      res.status(200).json({
        success: true,
        data: result.files.map(toApiArchivo),
        meta: getPaginationMeta(page, limit, result.total),
      });
    } catch (error) {
      next(error);
    }
  }

  async updateFile(req, res, next) {
    try {
      const archivo = await this.archivoService.updateFile(
        req.params.uuid,
        req.body,
        req.user,
      );
      res.status(200).json({
        success: true,
        message: 'Archivo actualizado correctamente',
        data: toApiArchivo(archivo),
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req, res, next) {
    try {
      const result = await this.archivoService.deleteFile(req.params.uuid, req.user);
      res.status(200).json({
        success: true,
        message: 'Archivo eliminado correctamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async downloadFile(req, res, next) {
    try {
      const descarga = await this.archivoService.getDownload(req.params.uuid, req.user || null);
      res.download(descarga.ruta, descarga.nombre, (error) => {
        if (error && !res.headersSent) next(error);
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ArchivoController;
