class PermisoController {
  constructor(permisoService) {
    this.permisoService = permisoService;
  }

  async create(req, res, next) {
    try {
      const result = await this.permisoService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page = 1, limit = 10, module: moduleName } = req.query;
      const result = await this.permisoService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        module: moduleName,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.permisoService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.permisoService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.permisoService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Permission deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PermisoController;
