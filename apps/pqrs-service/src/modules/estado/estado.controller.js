class EstadoController {
  constructor(estadoService) {
    this.estadoService = estadoService;
  }

  async create(req, res, next) {
    try {
      const result = await this.estadoService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const result = await this.estadoService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.estadoService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.estadoService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Status deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EstadoController;
