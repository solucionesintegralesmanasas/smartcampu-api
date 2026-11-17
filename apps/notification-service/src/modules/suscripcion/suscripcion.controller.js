class SuscripcionController {
  constructor(suscripcionService) {
    this.suscripcionService = suscripcionService;
  }

  async create(req, res, next) {
    try {
      const result = await this.suscripcionService.create(req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findMine(req, res, next) {
    try {
      const result = await this.suscripcionService.findMine(req.user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.suscripcionService.delete(req.params.id, req.user);
      res.status(200).json({ success: true, message: 'Subscription removed successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SuscripcionController;
