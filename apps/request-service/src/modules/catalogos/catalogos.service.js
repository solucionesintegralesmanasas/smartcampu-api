const logger = require('../../config/logger');

/**
 * Servicio de catálogos con caché opcional (cache-aside) en Redis.
 * Si Redis no está disponible, consulta siempre la base de datos.
 */
class CatalogosService {
  /**
   * @param {import('./catalogos.repository')} catalogosRepository
   * @param {object|null} [cache] - Cliente Redis con get/set.
   * @param {number} [ttl] - Segundos de vida de cada entrada.
   */
  constructor(catalogosRepository, cache = null, ttl = 3600) {
    this.repository = catalogosRepository;
    this.cache = cache;
    this.ttl = ttl;
  }

  listarCategorias() {
    return this.conCache('catalogo:categorias', () => this.repository.findCategorias());
  }

  listarTipos(categoriaUuid) {
    const clave = `catalogo:tipos:${categoriaUuid || 'todos'}`;
    return this.conCache(clave, () => this.repository.findTipos(categoriaUuid));
  }

  listarEstados() {
    return this.conCache('catalogo:estados', () => this.repository.findEstados());
  }

  async conCache(clave, cargar) {
    if (this.cache) {
      try {
        const cacheado = await this.cache.get(clave);
        if (cacheado) {
          return JSON.parse(cacheado);
        }
      } catch (error) {
        logger.warn('Caché de catálogos no disponible al leer', { error: error.message });
      }
    }

    const datos = await cargar();

    if (this.cache) {
      try {
        await this.cache.set(clave, JSON.stringify(datos), this.ttl);
      } catch (error) {
        logger.warn('Caché de catálogos no disponible al escribir', { error: error.message });
      }
    }

    return datos;
  }
}

module.exports = CatalogosService;
