const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

class EmpresaService {
  constructor(empresaRepository, redisClient) {
    this.empresaRepository = empresaRepository;
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
    const existing = await this.empresaRepository.findByTaxId(dto.taxId);
    if (existing) {
      throw new ConflictError('Company with this tax id already exists');
    }
    const empresa = await this.empresaRepository.create(dto);
    await this.invalidateCache();
    return empresa;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `empresas:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.empresaRepository.findAll({ page, limit });
    await safeCacheSet(this.redisClient, cacheKey, result, env.UNIVERSITY_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `empresas:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const empresa = await this.empresaRepository.findById(id);
    if (!empresa) {
      throw new NotFoundError('Company not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, empresa, env.UNIVERSITY_CACHE_TTL);
    return empresa;
  }

  async update(id, dto) {
    const existing = await this.empresaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Company not found');
    }

    const updated = await this.empresaRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`empresas:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.empresaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Company not found');
    }

    await this.empresaRepository.delete(id);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`empresas:${id}`]);
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await safeCacheInvalidate(this.redisClient, keys);
    this.listKeys.clear();
  }
}

module.exports = EmpresaService;
