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
      const { page = 1, limit = 10 } = req.query;
      const result = await this.documentTypeService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
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
      res.status(200).json({ success: true, message: 'Document type deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { search } = req.query;
      const result = await this.documentTypeService.search(search);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DocumentTypeController;
