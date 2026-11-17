const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

class TerceroService {
  constructor(terceroRepository, redisClient) {
    this.terceroRepository = terceroRepository;
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
    const existing = await this.terceroRepository.findByDocument(
      dto.documentTypeCode,
      dto.documentNumber,
    );
    if (existing) {
      throw new ConflictError('A person with this document already exists');
    }
    const tercero = await this.terceroRepository.create(dto);
    await this.invalidateCache();
    return tercero;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `terceros:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.terceroRepository.findAll({ page, limit });
    await safeCacheSet(this.redisClient, cacheKey, result, env.UNIVERSITY_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `terceros:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const tercero = await this.terceroRepository.findById(id);
    if (!tercero) {
      throw new NotFoundError('Person not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, tercero, env.UNIVERSITY_CACHE_TTL);
    return tercero;
  }

  async update(id, dto) {
    const existing = await this.terceroRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Person not found');
    }

    const updated = await this.terceroRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`terceros:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.terceroRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Person not found');
    }

    const activeRoles = await this.terceroRepository.countActiveRoles(id);
    if (activeRoles > 0) {
      throw new ConflictError('Cannot delete person: it is linked to an active student or teacher record');
    }

    await this.terceroRepository.delete(id);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`terceros:${id}`]);
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await safeCacheInvalidate(this.redisClient, keys);
    this.listKeys.clear();
  }
}

module.exports = TerceroService;
