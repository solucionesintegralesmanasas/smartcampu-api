const { ValidationError } = require('../../core/exceptions');

class ArchivoController {
  constructor(archivoService) {
    this.archivoService = archivoService;
  }

  async upload(req, res, next) {
    try {
      if (!req.file) {
        throw new ValidationError('No file was provided (field name must be "file")');
      }
      const result = await this.archivoService.upload(req.file, req.user, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const result = await this.archivoService.findAll(req.user, req.query);
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.archivoService.findById(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async download(req, res, next) {
    try {
      const { archivo, stream } = await this.archivoService.download(req.params.id, req.user);
      res.setHeader('Content-Type', archivo.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${archivo.originalName}"`);
      stream.on('error', next);
      stream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.archivoService.delete(req.params.id, req.user);
      res.status(200).json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ArchivoController;
