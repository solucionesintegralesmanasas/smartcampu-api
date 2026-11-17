class ProgramaController {
  constructor(programaService) {
    this.programaService = programaService;
  }

  async create(req, res, next) {
    try {
      const result = await this.programaService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const { page = 1, limit = 10, facultyId } = req.query;
      const result = await this.programaService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        facultyId: facultyId ? parseInt(facultyId, 10) : undefined,
      });
      res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async findById(req, res, next) {
    try {
      const result = await this.programaService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.programaService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.programaService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Program deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProgramaController;
