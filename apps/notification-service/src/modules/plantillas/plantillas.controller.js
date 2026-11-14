/**
 * Controlador HTTP de plantillas de notificación.
 */
class PlantillasController {
  constructor(plantillasService) {
    this.plantillasService = plantillasService;
  }

  async listar(req, res, next) {
    try {
      const { data, meta } = await this.plantillasService.listar(req.query);
      res.status(200).json({ success: true, data, meta });
    } catch (error) {
      next(error);
    }
  }

  async actualizar(req, res, next) {
    try {
      const data = await this.plantillasService.actualizar(req.params.code, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PlantillasController;
