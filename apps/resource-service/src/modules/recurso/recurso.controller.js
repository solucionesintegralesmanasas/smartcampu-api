class RecursoController {
  constructor(recursoService) {
    this.recursoService = recursoService;
  }

  async create(req, res, next) {
    try {
      const result = await this.recursoService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const {
        page = 1, limit = 10, categoryId, campusUuid,
      } = req.query;
      const result = await this.recursoService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
        campusUuid,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.recursoService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.recursoService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.recursoService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Resource deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async checkAvailability(req, res, next) {
    try {
      const result = await this.recursoService.checkAvailability(req.params.id, req.query);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = RecursoController;
