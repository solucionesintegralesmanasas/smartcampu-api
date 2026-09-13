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
      const {
        page = 1, limit = 20, search, facultadId, nivel,
      } = req.query;
      const result = await this.programaService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search,
        facultadId: facultadId ? parseInt(facultadId, 10) : undefined,
        nivel,
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
      const result = await this.programaService.delete(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { search, limit } = req.query;
      const result = await this.programaService.search({
        search,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProgramaController;
