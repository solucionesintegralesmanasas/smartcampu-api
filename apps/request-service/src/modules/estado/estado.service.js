const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

class EstadoService {
  constructor(estadoRepository, redisClient) {
    this.estadoRepository = estadoRepository;
    this.redisClient = redisClient;
    this.listKeys = new Set();
  }

  trackListKey(cacheKey) {
    this.listKeys.add(cacheKey);
  }

  async getCache(key) {
    return safeCacheGet(this.redisClient, key);
  }

  async create(dto) {
    const existing = await this.estadoRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictError('Status code already exists');
    }
    const estado = await this.estadoRepository.create(dto);
    await this.invalidateCache();
    return estado;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `estados-solicitud:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.estadoRepository.findAll({ page, limit });
    await safeCacheSet(this.redisClient, cacheKey, result, env.REQUEST_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `estados-solicitud:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const estado = await this.estadoRepository.findById(id);
    if (!estado) {
      throw new NotFoundError('Status not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, estado, env.REQUEST_CACHE_TTL);
    return estado;
  }

  async delete(id) {
    const existing = await this.estadoRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Status not found');
    }

    const activeRequests = await this.estadoRepository.countActiveRequests(id);
    if (activeRequests > 0) {
      throw new ConflictError('Cannot delete status: it is assigned to active requests');
    }

    await this.estadoRepository.delete(id);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`estados-solicitud:${id}`]);
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await safeCacheInvalidate(this.redisClient, keys);
    this.listKeys.clear();
  }
}

module.exports = EstadoService;
