class CatalogoController {
  /**
   * @param {import('./catalogo.service')} catalogoService
   */
  constructor(catalogoService) {
    this.catalogoService = catalogoService;
  }

  async listarTipos(req, res, next) {
    try {
      const data = await this.catalogoService.listarTipos();
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
