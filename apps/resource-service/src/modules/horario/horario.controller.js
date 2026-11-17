class HorarioController {
  constructor(horarioService) {
    this.horarioService = horarioService;
  }

  async create(req, res, next) {
    try {
      const result = await this.horarioService.create(req.params.resourceId, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByResourceId(req, res, next) {
    try {
      const result = await this.horarioService.findByResourceId(req.params.resourceId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const result = await this.horarioService.update(req.params.id, req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.horarioService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Schedule deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = HorarioController;
