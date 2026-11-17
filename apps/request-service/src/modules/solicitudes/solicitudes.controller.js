/**
 * Controlador HTTP de solicitudes. Delega toda la lógica en SolicitudesService.
 */
class SolicitudesController {
  /**
   * @param {import('./solicitudes.service')} solicitudesService
   */
  constructor(solicitudesService) {
    this.solicitudesService = solicitudesService;
  }

  async crear(req, res, next) {
    try {
      const data = await this.solicitudesService.crear(req.user, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listar(req, res, next) {
    try {
      const { data, meta } = await this.solicitudesService.listar(req.user, req.query);
      res.status(200).json({ success: true, data, meta });
    } catch (error) {
      next(error);
    }
  }

  async obtener(req, res, next) {
    try {
      const data = await this.solicitudesService.obtener(req.user, req.params.uuid);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async agregarComentario(req, res, next) {
    try {
      const data = await this.solicitudesService.agregarComentario(
        req.user,
        req.params.uuid,
        req.body,
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async agregarAdjunto(req, res, next) {
    try {
      const data = await this.solicitudesService.agregarAdjunto(
        req.user,
        req.params.uuid,
        req.body,
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async cambiarEstado(req, res, next) {
    try {
      const data = await this.solicitudesService.cambiarEstado(
        req.user,
        req.params.uuid,
        req.body,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SolicitudesController;
