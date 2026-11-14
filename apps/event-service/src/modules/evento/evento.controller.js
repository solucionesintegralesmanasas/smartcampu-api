/**
 * Controlador HTTP de eventos.
 */
class EventoController {
  constructor(eventoService) {
    this.eventoService = eventoService;
  }

  async listar(req, res, next) {
    try {
      const { data, meta } = await this.eventoService.listar(req.query, req.user || null);
      res.status(200).json({ success: true, data, meta });
    } catch (error) {
      next(error);
    }
  }

  async obtener(req, res, next) {
    try {
      const data = await this.eventoService.obtener(req.params.uuid, req.user || null);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async crear(req, res, next) {
    try {
      const data = await this.eventoService.crear(req.body, req.user);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async actualizar(req, res, next) {
    try {
      const data = await this.eventoService.actualizar(req.params.uuid, req.body, req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async eliminar(req, res, next) {
    try {
      const data = await this.eventoService.eliminar(req.params.uuid, req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async cambiarEstado(req, res, next) {
    try {
      const data = await this.eventoService.cambiarEstado(
        req.params.uuid,
        req.body.estado,
        req.user,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = EventoController;
