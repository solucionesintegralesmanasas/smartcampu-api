/**
 * Controlador HTTP de catálogos de solicitudes (solo lectura).
 */
class CatalogosController {
  /**
   * @param {import('./catalogos.service')} catalogosService
   */
  constructor(catalogosService) {
    this.catalogosService = catalogosService;
  }

  async listarCategorias(req, res, next) {
    try {
      const data = await this.catalogosService.listarCategorias();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listarTipos(req, res, next) {
    try {
      const data = await this.catalogosService.listarTipos(req.query.categoriaUuid);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listarEstados(req, res, next) {
    try {
      const data = await this.catalogosService.listarEstados();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CatalogosController;
