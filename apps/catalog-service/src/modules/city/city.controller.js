class CityController {
  constructor(cityService) {
    this.cityService = cityService;
  }

  async create(req, res, next) {
    try {
      const result = await this.cityService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const result = await this.cityService.findAll({
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
      const result = await this.cityService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByStateId(req, res, next) {
    try {
      const result = await this.cityService.findByStateId(req.params.stateId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.cityService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.cityService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'City deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { search } = req.query;
      const result = await this.cityService.search(search);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CityController;
