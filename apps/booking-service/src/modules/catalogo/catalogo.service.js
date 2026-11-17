/**
 * Servicio de catálogos de reservas (tipos y estados). Solo lectura.
 */
class CatalogoService {
  /**
   * @param {import('./catalogo.repository')} catalogoRepository
   */
  constructor(catalogoRepository) {
    this.catalogoRepository = catalogoRepository;
  }

  listarTipos() {
    return this.catalogoRepository.listTipos();
  }

  listarEstados() {
    return this.catalogoRepository.listEstados();
  }
}

module.exports = CatalogoService;
