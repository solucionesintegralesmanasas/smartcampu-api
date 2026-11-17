const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

const ES_TYPE = 'estudiante';

class EstudianteService {
  constructor(estudianteRepository, terceroRepository, programaRepository, redisClient) {
    this.estudianteRepository = estudianteRepository;
    this.terceroRepository = terceroRepository;
    this.programaRepository = programaRepository;
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
    const [tercero, programa, existingByPerson, existingByCode] = await Promise.all([
      this.terceroRepository.findById(dto.personId),
      this.programaRepository.findById(dto.programId),
      this.estudianteRepository.findByPersonId(dto.personId),
      this.estudianteRepository.findByCode(dto.studentCode),
    ]);

    if (!tercero) {
      throw new NotFoundError('Person not found');
    }
    if (!programa) {
      throw new NotFoundError('Program not found');
    }
    if (existingByPerson) {
      throw new ConflictError('This person is already registered as a student');
    }
    if (existingByCode) {
      throw new ConflictError('Student code already exists');
    }

    const estudiante = await this.estudianteRepository.create(dto);
    await this.indexEntity(estudiante, tercero, programa);
    await this.invalidateCache();
    return estudiante;
  }

  async findAll({
    page = 1, limit = 10, programId, status,
  } = {}) {
    const cacheKey = `estudiantes:all:${page}:${limit}:${programId ?? ''}:${status ?? ''}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.estudianteRepository.findAll({
      page, limit, programId, status,
    });
    await safeCacheSet(this.redisClient, cacheKey, result, env.UNIVERSITY_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `estudiantes:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const estudiante = await this.estudianteRepository.findById(id);
    if (!estudiante) {
      throw new NotFoundError('Student not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, estudiante, env.UNIVERSITY_CACHE_TTL);
    return estudiante;
  }

  /**
   * Usado por user-service (perfil polimórfico) vía llamada de servicio a
   * servicio, buscando por auth.users.uuid (no por el id numérico interno).
   */
  async findByUserUuid(userUuid) {
    const estudiante = await this.estudianteRepository.findByUserUuid(userUuid);
    if (!estudiante) {
      throw new NotFoundError('Student not found for this user');
    }
    return estudiante;
  }

  async update(id, dto) {
    const existing = await this.estudianteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Student not found');
    }

    const updated = await this.estudianteRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`estudiantes:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.estudianteRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Student not found');
    }

    await this.estudianteRepository.delete(id);

    try {
      await esClient.delete({ index: env.UNIVERSITY_INDEX, id: `${ES_TYPE}-${existing.uuid}` });
    } catch (error) {
      // ES delete is non-blocking
    }

    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`estudiantes:${id}`]);
  }

  async indexEntity(estudiante, tercero, programa) {
    try {
      await esClient.index({
        index: env.UNIVERSITY_INDEX,
        id: `${ES_TYPE}-${estudiante.uuid}`,
        document: {
          type: ES_TYPE,
          id: estudiante.id,
          nombre: `${tercero.firstName} ${tercero.lastName}`,
          codigo: estudiante.studentCode,
          estado: estudiante.status,
          parent: { id: programa.id, type: 'programa', nombre: programa.name },
          createdAt: estudiante.createdAt,
          updatedAt: estudiante.updatedAt,
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

module.exports = EstudianteService;
