/**
 * Controlador HTTP de disponibilidad de recursos.
 */
class AvailabilityController {
  constructor(availabilityService) {
    this.availabilityService = availabilityService;
  }

  async consultar(req, res, next) {
    try {
      const data = await this.availabilityService.consultar(req.params.id, req.query);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AvailabilityController;
