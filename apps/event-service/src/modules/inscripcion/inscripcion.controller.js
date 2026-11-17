class InscripcionController {
  constructor(inscripcionService) {
    this.inscripcionService = inscripcionService;
  }

  async register(req, res, next) {
    try {
      const result = await this.inscripcionService.register(req.params.eventId, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findMine(req, res, next) {
    try {
      const result = await this.inscripcionService.findMine(req.params.eventId, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByEventId(req, res, next) {
    try {
      const result = await this.inscripcionService.findByEventId(req.params.eventId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const result = await this.inscripcionService.cancel(req.params.eventId, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async checkIn(req, res, next) {
    try {
      const result = await this.inscripcionService.checkIn(req.params.id, req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InscripcionController;
