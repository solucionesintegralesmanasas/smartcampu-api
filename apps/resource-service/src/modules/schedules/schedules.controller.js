class SchedulesController {
  /**
   * @param {import('./schedules.service')} schedulesService
   */
  constructor(schedulesService) {
    this.schedulesService = schedulesService;
  }

  async findByResource(req, res, next) {
    try {
      const data = await this.schedulesService.findByResource(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async replace(req, res, next) {
    try {
      const data = await this.schedulesService.replace(req.params.id, req.body.horarios);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SchedulesController;
