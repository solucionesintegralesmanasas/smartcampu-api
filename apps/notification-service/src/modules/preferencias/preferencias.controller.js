/**
 * Controlador HTTP de preferencias de notificación.
 */
class PreferenciasController {
  constructor(preferenciasService) {
    this.preferenciasService = preferenciasService;
  }

  async obtener(req, res, next) {
    try {
      const data = await this.preferenciasService.obtener(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async actualizar(req, res, next) {
    try {
      const data = await this.preferenciasService.actualizar(req.user, req.body.preferencias);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PreferenciasController;
