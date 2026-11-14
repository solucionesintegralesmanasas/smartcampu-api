/**
 * Controlador HTTP de catálogos de eventos (solo lectura).
 */
class CatalogoController {
  constructor(catalogoService) {
    this.catalogoService = catalogoService;
  }

  async listarCategorias(req, res, next) {
    try {
      const data = await this.catalogoService.listarCategorias();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listarEstados(req, res, next) {
    try {
      const data = await this.catalogoService.listarEstados();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CatalogoController;
