const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

const ES_TYPE = 'programa';

class ProgramaService {
  constructor(programaRepository, facultadRepository, redisClient) {
    this.programaRepository = programaRepository;
    this.facultadRepository = facultadRepository;
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
    const facultad = await this.facultadRepository.findById(dto.facultyId);
    if (!facultad) {
      throw new NotFoundError('Faculty not found');
    }

    const existing = await this.programaRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictError('Program code already exists');
    }

    const programa = await this.programaRepository.create(dto);
    await this.indexEntity(programa, facultad);
    await this.invalidateCache();
    return programa;
  }

  async findAll({ page = 1, limit = 10, facultyId } = {}) {
    const cacheKey = `programas:all:${page}:${limit}:${facultyId ?? ''}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.programaRepository.findAll({ page, limit, facultyId });
    await safeCacheSet(this.redisClient, cacheKey, result, env.UNIVERSITY_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `programas:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const programa = await this.programaRepository.findById(id);
    if (!programa) {
      throw new NotFoundError('Program not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, programa, env.UNIVERSITY_CACHE_TTL);
    return programa;
  }

  async update(id, dto) {
    const existing = await this.programaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Program not found');
    }

    const updated = await this.programaRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`programas:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.programaRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Program not found');
    }

    const activeStudents = await this.programaRepository.countActiveStudents(id);
    if (activeStudents > 0) {
      throw new ConflictError('Cannot delete program: it has active students');
    }

    await this.programaRepository.delete(id);

    try {
      await esClient.delete({ index: env.UNIVERSITY_INDEX, id: `${ES_TYPE}-${existing.uuid}` });
    } catch (error) {
      // ES delete is non-blocking
    }

    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`programas:${id}`]);
  }

  async indexEntity(programa, facultad) {
    try {
      await esClient.index({
        index: env.UNIVERSITY_INDEX,
        id: `${ES_TYPE}-${programa.uuid}`,
        document: {
          type: ES_TYPE,
          id: programa.id,
          nombre: programa.name,
          codigo: programa.code,
          estado: programa.isActive ? 'active' : 'inactive',
          parent: { id: facultad.id, type: 'facultad', nombre: facultad.name },
          createdAt: programa.createdAt,
          updatedAt: programa.updatedAt,
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

module.exports = ProgramaService;
