const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

const ES_TYPE = 'sede';

class SedeService {
  constructor(sedeRepository, redisClient) {
    this.sedeRepository = sedeRepository;
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
    const existing = await this.sedeRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictError('Sede name already exists');
    }

    const sede = await this.sedeRepository.create(dto);
    await this.indexEntity(sede);
    await this.invalidateCache();

    return sede;
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const cacheKey = `sedes:all:${page}:${limit}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.sedeRepository.findAll({ page, limit });
    await safeCacheSet(this.redisClient, cacheKey, result, env.UNIVERSITY_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `sedes:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const sede = await this.sedeRepository.findById(id);
    if (!sede) {
      throw new NotFoundError('Sede not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, sede, env.UNIVERSITY_CACHE_TTL);
    return sede;
  }

  async update(id, dto) {
    const existing = await this.sedeRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Sede not found');
    }

    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.sedeRepository.findByName(dto.name);
      if (duplicate) {
        throw new ConflictError('Sede name already exists');
      }
    }

    const updated = await this.sedeRepository.update(id, dto);
    await this.indexEntity(updated);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`sedes:${id}`]);

    return updated;
  }

  async delete(id) {
    const existing = await this.sedeRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Sede not found');
    }

    const activeFaculties = await this.sedeRepository.countActiveFaculties(id);
    if (activeFaculties > 0) {
      throw new ConflictError('Cannot delete sede: it has active faculties');
    }

    await this.sedeRepository.delete(id);

    try {
      await esClient.delete({ index: env.UNIVERSITY_INDEX, id: `${ES_TYPE}-${existing.uuid}` });
    } catch (error) {
      // ES delete is non-blocking
    }

    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`sedes:${id}`]);
  }

  async indexEntity(sede) {
    try {
      await esClient.index({
        index: env.UNIVERSITY_INDEX,
        id: `${ES_TYPE}-${sede.uuid}`,
        document: {
          type: ES_TYPE,
          id: sede.id,
          nombre: sede.name,
          estado: sede.isActive ? 'active' : 'inactive',
          createdAt: sede.createdAt,
          updatedAt: sede.updatedAt,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }
  }

  async invalidateCache() {
    const keys = Array.from(this.listKeys);
    await safeCacheInvalidate(this.redisClient, keys);
    this.listKeys.clear();
  }
}

module.exports = SedeService;
