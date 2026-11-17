const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

const ES_TYPE = 'facultad';

class FacultadService {
  constructor(facultadRepository, sedeRepository, redisClient) {
    this.facultadRepository = facultadRepository;
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
    const sede = await this.sedeRepository.findById(dto.campusId);
    if (!sede) {
      throw new NotFoundError('Sede not found');
    }

    const existing = await this.facultadRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictError('Faculty code already exists');
    }

    const facultad = await this.facultadRepository.create(dto);
    await this.indexEntity(facultad, sede);
    await this.invalidateCache();
    return facultad;
  }

  async findAll({ page = 1, limit = 10, campusId } = {}) {
    const cacheKey = `facultades:all:${page}:${limit}:${campusId ?? ''}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.facultadRepository.findAll({ page, limit, campusId });
    await safeCacheSet(this.redisClient, cacheKey, result, env.UNIVERSITY_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `facultades:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const facultad = await this.facultadRepository.findById(id);
    if (!facultad) {
      throw new NotFoundError('Faculty not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, facultad, env.UNIVERSITY_CACHE_TTL);
    return facultad;
  }

  async update(id, dto) {
    const existing = await this.facultadRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Faculty not found');
    }

    const updated = await this.facultadRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`facultades:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.facultadRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Faculty not found');
    }

    const [activePrograms, activeTeachers] = await Promise.all([
      this.facultadRepository.countActivePrograms(id),
      this.facultadRepository.countActiveTeachers(id),
    ]);
    if (activePrograms > 0 || activeTeachers > 0) {
      throw new ConflictError('Cannot delete faculty: it has active programs or teachers');
    }

    await this.facultadRepository.delete(id);

    try {
      await esClient.delete({ index: env.UNIVERSITY_INDEX, id: `${ES_TYPE}-${existing.uuid}` });
    } catch (error) {
      // ES delete is non-blocking
    }

    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`facultades:${id}`]);
  }

  async indexEntity(facultad, sede) {
    try {
      await esClient.index({
        index: env.UNIVERSITY_INDEX,
        id: `${ES_TYPE}-${facultad.uuid}`,
        document: {
          type: ES_TYPE,
          id: facultad.id,
          nombre: facultad.name,
          codigo: facultad.code,
          estado: facultad.isActive ? 'active' : 'inactive',
          parent: { id: sede.id, type: 'sede', nombre: sede.name },
          createdAt: facultad.createdAt,
          updatedAt: facultad.updatedAt,
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

module.exports = FacultadService;
