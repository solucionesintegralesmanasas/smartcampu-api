/**
 * Controlador HTTP de notificaciones in-app del usuario.
 */
class NotificacionesController {
  constructor(notificacionesService) {
    this.notificacionesService = notificacionesService;
  }

  async listar(req, res, next) {
    try {
      const { data, meta } = await this.notificacionesService.listar(req.user, req.query);
      res.status(200).json({ success: true, data, meta });
    } catch (error) {
      next(error);
    }
  }

  async marcarLeida(req, res, next) {
    try {
      const data = await this.notificacionesService.marcarLeida(req.user, req.params.uuid);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async marcarTodasLeidas(req, res, next) {
    try {
      const data = await this.notificacionesService.marcarTodasLeidas(req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async difundir(req, res, next) {
    try {
      const data = await this.notificacionesService.difundir(req.body, req.user);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NotificacionesController;
