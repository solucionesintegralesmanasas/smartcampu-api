const logger = require('../../config/logger');
const { getRedisClient } = require('../../config/database/redis');

const { env } = require('../../config/env');
const CatalogoRepository = require('./catalogo.repository');

/**
 * Catálogos de eventos (categorías y estados) con caché opcional en Redis.
 */
class CatalogoService {
  /**
   * @param {import('./catalogo.repository')} catalogoRepository
   * @param {object|null} [cache]
   * @param {number} [ttl]
   */
  constructor(
    catalogoRepository,
    cache = null,
    ttl = env.CATALOG_CACHE_TTL,
  ) {
    this.repository = catalogoRepository;
    this.cache = cache;
    this.ttl = ttl;
  }

  listarCategorias() {
    return this.conCache('eventos:catalogo:categorias', () => this.repository.findCategorias());
  }

  listarEstados() {
    return this.conCache('eventos:catalogo:estados', () => this.repository.findEstados());
  }

  async conCache(clave, cargar) {
    if (this.cache) {
      try {
        const cacheado = await this.cache.get(clave);
        if (cacheado) return JSON.parse(cacheado);
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

/** Construye el servicio con el caché real (o null si Redis no está disponible). */
const crearCatalogoService = () => {
  let cache = null;
  try {
    cache = getRedisClient();
  } catch (error) {
    cache = null;
  }
  return new CatalogoService(new CatalogoRepository(), cache);
};

module.exports = CatalogoService;
module.exports.crearCatalogoService = crearCatalogoService;
