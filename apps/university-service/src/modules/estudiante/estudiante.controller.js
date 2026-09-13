class EstudianteController {
  constructor(estudianteService) {
    this.estudianteService = estudianteService;
  }

  async create(req, res, next) {
    try {
      const result = await this.estudianteService.create(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req, res, next) {
    try {
      const {
        page = 1, limit = 20, search, programaId, personaId, estado,
      } = req.query;
      const result = await this.estudianteService.findAll({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        search,
        programaId: programaId ? parseInt(programaId, 10) : undefined,
        personaId: personaId ? parseInt(personaId, 10) : undefined,
        estado,
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
      const result = await this.estudianteService.findById(req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.estudianteService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const result = await this.estudianteService.delete(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async search(req, res, next) {
    try {
      const { search, limit } = req.query;
      const result = await this.estudianteService.search({
        search,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EstudianteController;
