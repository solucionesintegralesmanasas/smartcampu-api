class PlantillaController {
  constructor(plantillaService) {
    this.plantillaService = plantillaService;
  }

  async create(req, res, next) {
    try {
      const result = await this.plantillaService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page = 1, limit = 10, channel } = req.query;
      const result = await this.plantillaService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        channel,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.plantillaService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.plantillaService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.plantillaService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PlantillaController;
