class BlackoutsController {
  /**
   * @param {import('./blackouts.service')} blackoutsService
   */
  constructor(blackoutsService) {
    this.blackoutsService = blackoutsService;
  }

  async findAll(req, res, next) {
    try {
      const result = await this.blackoutsService.findAll(req.params.id, req.query);
      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const data = await this.blackoutsService.create(req.params.id, req.body, req.user);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      await this.blackoutsService.remove(req.params.id, req.params.bloqueoId);
      res.status(200).json({ success: true, message: 'Bloqueo eliminado correctamente' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BlackoutsController;
