const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

class CategoriaService {
  constructor(categoriaRepository, redisClient) {
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
    const existing = await this.categoriaRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictError('Category code already exists');
    }
    const categoria = await this.categoriaRepository.create(dto);
    await this.invalidateCache();
    return categoria;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `categorias-evento:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.categoriaRepository.findAll({ page, limit });
    await safeCacheSet(this.redisClient, cacheKey, result, env.EVENT_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `categorias-evento:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const categoria = await this.categoriaRepository.findById(id);
    if (!categoria) {
      throw new NotFoundError('Category not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, categoria, env.EVENT_CACHE_TTL);
    return categoria;
  }

  async update(id, dto) {
    const existing = await this.categoriaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    const updated = await this.categoriaRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`categorias-evento:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.categoriaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    const activeEvents = await this.categoriaRepository.countActiveEvents(id);
    if (activeEvents > 0) {
      throw new ConflictError('Cannot delete category: it has active events');
    }

    await this.categoriaRepository.delete(id);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`categorias-evento:${id}`]);
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await safeCacheInvalidate(this.redisClient, keys);
    this.listKeys.clear();
  }
}

module.exports = CategoriaService;
