class EmpresaController {
  constructor(empresaService) {
    this.empresaService = empresaService;
  }

  async create(req, res, next) {
    try {
      const result = await this.empresaService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page = 1, limit = 20, search } = req.query;
      const result = await this.empresaService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search,
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
      const result = await this.empresaService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.empresaService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.empresaService.delete(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { search, limit } = req.query;
      const result = await this.empresaService.search({
        search,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EmpresaController;
