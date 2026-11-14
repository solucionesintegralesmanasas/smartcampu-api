/**
 * Controlador HTTP de PQRS. Delega toda la lógica en PqrsService.
 */
class PqrsController {
  /**
   * @param {import('./pqrs.service')} pqrsService
   */
  constructor(pqrsService) {
    this.pqrsService = pqrsService;
  }

  async crear(req, res, next) {
    try {
      const data = await this.pqrsService.crear(req.user, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async consultar(req, res, next) {
    try {
      const data = await this.pqrsService.consultarPorRadicado(
        req.params.ticket,
        req.query.email,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listarMias(req, res, next) {
    try {
      const { data, meta } = await this.pqrsService.listarMias(req.user, req.query);
      res.status(200).json({ success: true, data, meta });
    } catch (error) {
      next(error);
    }
  }

  async listarPersonal(req, res, next) {
    try {
      const { data, meta } = await this.pqrsService.listarPersonal(req.query);
      res.status(200).json({ success: true, data, meta });
    } catch (error) {
      next(error);
    }
  }

  async obtener(req, res, next) {
    try {
      const data = await this.pqrsService.obtener(req.user, req.params.uuid);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async asignar(req, res, next) {
    try {
      const data = await this.pqrsService.asignar(req.user, req.params.uuid, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async responder(req, res, next) {
    try {
      const data = await this.pqrsService.responder(req.user, req.params.uuid, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async cambiarEstado(req, res, next) {
    try {
      const data = await this.pqrsService.cambiarEstado(req.user, req.params.uuid, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async calificar(req, res, next) {
    try {
      const data = await this.pqrsService.calificar(req.user, req.params.uuid, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PqrsController;
