class FacultadController {
  constructor(facultadService) {
    this.facultadService = facultadService;
  }

  async create(req, res, next) {
    try {
      const result = await this.facultadService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page = 1, limit = 10, campusId } = req.query;
      const result = await this.facultadService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        campusId: campusId ? parseInt(campusId, 10) : undefined,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.facultadService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.facultadService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.facultadService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Faculty deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = FacultadController;
