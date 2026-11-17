class TipoController {
  constructor(tipoService) {
    this.tipoService = tipoService;
  }

  async create(req, res, next) {
    try {
      const result = await this.tipoService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const result = await this.tipoService.findAll({
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
      const result = await this.tipoService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.tipoService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.tipoService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Booking type deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TipoController;
