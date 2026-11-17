class DocenteController {
  constructor(docenteService) {
    this.docenteService = docenteService;
  }

  async create(req, res, next) {
    try {
      const result = await this.docenteService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const {
        page = 1, limit = 10, facultyId, status,
      } = req.query;
      const result = await this.docenteService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        facultyId: facultyId ? parseInt(facultyId, 10) : undefined,
        status,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.docenteService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByUserUuid(req, res, next) {
    try {
      const result = await this.docenteService.findByUserUuid(req.params.userUuid);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.docenteService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.docenteService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Teacher deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DocenteController;
