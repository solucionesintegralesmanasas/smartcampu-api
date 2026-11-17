class BloqueoController {
  constructor(bloqueoService) {
    this.bloqueoService = bloqueoService;
  }

  async create(req, res, next) {
    try {
      const result = await this.bloqueoService.create(req.params.resourceId, req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async findByResourceId(req, res, next) {
    try {
      const result = await this.bloqueoService.findByResourceId(req.params.resourceId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.bloqueoService.delete(req.params.id);
      res.status(200).json({ success: true, message: 'Blackout deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BloqueoController;
