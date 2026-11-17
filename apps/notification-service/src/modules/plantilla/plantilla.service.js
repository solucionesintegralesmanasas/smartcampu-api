const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

class PlantillaService {
  constructor(plantillaRepository, redisClient) {
    this.plantillaRepository = plantillaRepository;
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
    const existing = await this.plantillaRepository.findByCodeAndChannel(dto.code, dto.channel);
    if (existing) {
      throw new ConflictError('A template with this code and channel already exists');
    }
    const plantilla = await this.plantillaRepository.create(dto);
    await this.invalidateCache();
    return plantilla;
  }

  async findAll({ page = 1, limit = 10, channel } = {}) {
    const cacheKey = `plantillas:all:${page}:${limit}:${channel ?? ''}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.plantillaRepository.findAll({ page, limit, channel });
    await safeCacheSet(this.redisClient, cacheKey, result, env.NOTIFICATION_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `plantillas:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const plantilla = await this.plantillaRepository.findById(id);
    if (!plantilla) {
      throw new NotFoundError('Template not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, plantilla, env.NOTIFICATION_CACHE_TTL);
    return plantilla;
  }

  async update(id, dto) {
    const existing = await this.plantillaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    const updated = await this.plantillaRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`plantillas:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.plantillaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    await this.plantillaRepository.delete(id);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`plantillas:${id}`]);
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await safeCacheInvalidate(this.redisClient, keys);
    this.listKeys.clear();
  }
}

module.exports = PlantillaService;
