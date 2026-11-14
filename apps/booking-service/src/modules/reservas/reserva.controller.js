class ReservaController {
  /**
   * @param {import('./reserva.service')} reservaService
   */
  constructor(reservaService) {
    this.reservaService = reservaService;
  }

  async crear(req, res, next) {
    try {
      const data = await this.reservaService.crear(req.body, req.user);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listar(req, res, next) {
    try {
      const { data, meta } = await this.reservaService.listar(req.query, req.user);
      res.status(200).json({ success: true, data, meta });
    } catch (error) {
      next(error);
    }
  }

  async obtener(req, res, next) {
    try {
      const data = await this.reservaService.obtener(req.params.uuid, req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async cambiarEstado(req, res, next) {
    try {
      const data = await this.reservaService.cambiarEstado(req.params.uuid, req.body, req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async cancelar(req, res, next) {
    try {
      const data = await this.reservaService.cancelar(req.params.uuid, req.body, req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReservaController;
