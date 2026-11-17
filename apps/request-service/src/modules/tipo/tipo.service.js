const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

class TipoService {
  constructor(tipoRepository, categoriaRepository, redisClient) {
    this.tipoRepository = tipoRepository;
    this.categoriaRepository = categoriaRepository;
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
    const categoria = await this.categoriaRepository.findById(dto.categoryId);
    if (!categoria) {
      throw new NotFoundError('Category not found');
    }

    const existing = await this.tipoRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictError('Request type code already exists');
    }

    const tipo = await this.tipoRepository.create(dto);
    await this.invalidateCache();
    return tipo;
  }

  async findAll({ page = 1, limit = 10, categoryId } = {}) {
    const cacheKey = `tipos-solicitud:all:${page}:${limit}:${categoryId ?? ''}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.tipoRepository.findAll({ page, limit, categoryId });
    await safeCacheSet(this.redisClient, cacheKey, result, env.REQUEST_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `tipos-solicitud:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const tipo = await this.tipoRepository.findById(id);
    if (!tipo) {
      throw new NotFoundError('Request type not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, tipo, env.REQUEST_CACHE_TTL);
    return tipo;
  }

  async update(id, dto) {
    const existing = await this.tipoRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Request type not found');
    }

    const updated = await this.tipoRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`tipos-solicitud:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.tipoRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Request type not found');
    }

    const activeRequests = await this.tipoRepository.countActiveRequests(id);
    if (activeRequests > 0) {
      throw new ConflictError('Cannot delete request type: it has active requests');
    }

    await this.tipoRepository.delete(id);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`tipos-solicitud:${id}`]);
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await safeCacheInvalidate(this.redisClient, keys);
    this.listKeys.clear();
  }
}

module.exports = TipoService;
