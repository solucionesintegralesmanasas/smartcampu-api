class TerceroController {
  constructor(terceroService) {
    this.terceroService = terceroService;
  }

  async create(req, res, next) {
    try {
      const result = await this.terceroService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const {
        page = 1, limit = 20, search, tipoDocumento, empresaId,
      } = req.query;
      const result = await this.terceroService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search,
        tipoDocumento,
        empresaId: empresaId ? parseInt(empresaId, 10) : undefined,
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
      const result = await this.terceroService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.terceroService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.terceroService.delete(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { search, limit, type } = req.query;
      const result = await this.terceroService.search({
        search,
        type,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TerceroController;
