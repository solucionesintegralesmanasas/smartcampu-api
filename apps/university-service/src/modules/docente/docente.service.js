const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

const ES_TYPE = 'docente';

class DocenteService {
  constructor(docenteRepository, terceroRepository, facultadRepository, redisClient) {
    this.docenteRepository = docenteRepository;
    this.terceroRepository = terceroRepository;
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
    const [tercero, facultad, existingByPerson, existingByCode] = await Promise.all([
      this.terceroRepository.findById(dto.personId),
      this.facultadRepository.findById(dto.facultyId),
      this.docenteRepository.findByPersonId(dto.personId),
      this.docenteRepository.findByCode(dto.teacherCode),
    ]);

    if (!tercero) {
      throw new NotFoundError('Person not found');
    }
    if (!facultad) {
      throw new NotFoundError('Faculty not found');
    }
    if (existingByPerson) {
      throw new ConflictError('This person is already registered as a teacher');
    }
    if (existingByCode) {
      throw new ConflictError('Teacher code already exists');
    }

    const docente = await this.docenteRepository.create(dto);
    await this.indexEntity(docente, tercero, facultad);
    await this.invalidateCache();
    return docente;
  }

  async findAll({
    page = 1, limit = 10, facultyId, status,
  } = {}) {
    const cacheKey = `docentes:all:${page}:${limit}:${facultyId ?? ''}:${status ?? ''}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.docenteRepository.findAll({
      page, limit, facultyId, status,
    });
    await safeCacheSet(this.redisClient, cacheKey, result, env.UNIVERSITY_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `docentes:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const docente = await this.docenteRepository.findById(id);
    if (!docente) {
      throw new NotFoundError('Teacher not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, docente, env.UNIVERSITY_CACHE_TTL);
    return docente;
  }

  /**
   * Usado por user-service (perfil polimórfico) vía llamada de servicio a
   * servicio, buscando por auth.users.uuid (no por el id numérico interno).
   */
  async findByUserUuid(userUuid) {
    const docente = await this.docenteRepository.findByUserUuid(userUuid);
    if (!docente) {
      throw new NotFoundError('Teacher not found for this user');
    }
    return docente;
  }

  async update(id, dto) {
    const existing = await this.docenteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Teacher not found');
    }

    const updated = await this.docenteRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`docentes:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.docenteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Teacher not found');
    }

    await this.docenteRepository.delete(id);

    try {
      await esClient.delete({ index: env.UNIVERSITY_INDEX, id: `${ES_TYPE}-${existing.uuid}` });
    } catch (error) {
      // ES delete is non-blocking
    }

    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`docentes:${id}`]);
  }

  async indexEntity(docente, tercero, facultad) {
    try {
      await esClient.index({
        index: env.UNIVERSITY_INDEX,
        id: `${ES_TYPE}-${docente.uuid}`,
        document: {
          type: ES_TYPE,
          id: docente.id,
          nombre: `${tercero.firstName} ${tercero.lastName}`,
          codigo: docente.teacherCode,
          estado: docente.status,
          parent: { id: facultad.id, type: 'facultad', nombre: facultad.name },
          createdAt: docente.createdAt,
          updatedAt: docente.updatedAt,
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

module.exports = DocenteService;
