class StatusesController {
  /**
   * @param {import('./statuses.service')} statusesService
   */
  constructor(statusesService) {
    this.statusesService = statusesService;
  }

  async findAll(req, res, next) {
    try {
      const data = await this.statusesService.findAll();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = StatusesController;
