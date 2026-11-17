/**
 * Controlador HTTP de suscripciones push.
 */
class SuscripcionesController {
  constructor(suscripcionesService) {
    this.suscripcionesService = suscripcionesService;
  }

  async registrar(req, res, next) {
    try {
      const data = await this.suscripcionesService.registrar(req.user, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async eliminar(req, res, next) {
    try {
      const data = await this.suscripcionesService.eliminar(req.user, req.params.uuid);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SuscripcionesController;
