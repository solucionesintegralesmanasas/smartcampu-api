const { paginationHelper } = require('../../core/helpers/pagination.helper');

class DocumentTypeController {
  constructor(documentTypeService) {
    this.documentTypeService = documentTypeService;
  }

  async create(req, res, next) {
    try {
      const result = await this.documentTypeService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page, limit } = paginationHelper(req.query.page, req.query.limit ?? 10);
      const result = await this.documentTypeService.findAll({ page, limit });
      res.status(200).json({ success: true, data: result.data, meta: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.documentTypeService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.documentTypeService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.documentTypeService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Tipo de documento eliminado correctamente' });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const result = await this.documentTypeService.search(req.query.search);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DocumentTypeController;
