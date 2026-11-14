/**
 * Controlador HTTP de inscripciones a eventos.
 */
class InscripcionController {
  constructor(inscripcionService) {
    this.inscripcionService = inscripcionService;
  }

  async inscribir(req, res, next) {
    try {
      const data = await this.inscripcionService.inscribir(req.params.uuid, req.user);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listar(req, res, next) {
    try {
      const { data, meta } = await this.inscripcionService.listar(req.params.uuid, req.query);
      res.status(200).json({ success: true, data, meta });
    } catch (error) {
      next(error);
    }
  }

  async cancelar(req, res, next) {
    try {
      const data = await this.inscripcionService.cancelar(req.params.uuid, req.user);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = InscripcionController;
