const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

class RecursoService {
  constructor(
    recursoRepository,
    categoriaRepository,
    estadoRepository,
    horarioRepository,
    bloqueoRepository,
    redisClient,
  ) {
    this.recursoRepository = recursoRepository;
    this.categoriaRepository = categoriaRepository;
    this.estadoRepository = estadoRepository;
    this.horarioRepository = horarioRepository;
    this.bloqueoRepository = bloqueoRepository;
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
    const [categoria, estado, existing] = await Promise.all([
      this.categoriaRepository.findById(dto.categoryId),
      this.estadoRepository.findById(dto.statusId),
      this.recursoRepository.findByCode(dto.code),
    ]);

    if (!categoria) {
      throw new NotFoundError('Category not found');
    }
    if (!estado) {
      throw new NotFoundError('Status not found');
    }
    if (existing) {
      throw new ConflictError('Resource code already exists');
    }

    const recurso = await this.recursoRepository.create(dto);
    await this.indexEntity(recurso, categoria);
    await this.invalidateCache();
    return recurso;
  }

  async findAll({
    page = 1, limit = 10, categoryId, campusUuid,
  } = {}) {
    const cacheKey = `recursos:all:${page}:${limit}:${categoryId ?? ''}:${campusUuid ?? ''}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.recursoRepository.findAll({
      page, limit, categoryId, campusUuid,
    });
    await safeCacheSet(this.redisClient, cacheKey, result, env.RESOURCE_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `recursos:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const recurso = await this.recursoRepository.findById(id);
    if (!recurso) {
      throw new NotFoundError('Resource not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, recurso, env.RESOURCE_CACHE_TTL);
    return recurso;
  }

  async update(id, dto) {
    const existing = await this.recursoRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Resource not found');
    }

    if (dto.statusId !== undefined) {
      const estado = await this.estadoRepository.findById(dto.statusId);
      if (!estado) {
        throw new NotFoundError('Status not found');
      }
    }

    const updated = await this.recursoRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`recursos:${id}`]);
    return updated;
  }

  async delete(id) {
    const existing = await this.recursoRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Resource not found');
    }

    await this.recursoRepository.delete(id);

    try {
      await esClient.delete({ index: env.RESOURCE_INDEX, id: existing.uuid });
    } catch (error) {
      // ES delete is non-blocking
    }

    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`recursos:${id}`]);
  }

  /**
   * Disponibilidad OPERATIVA del recurso: estado reservable + dentro del
   * horario semanal + sin bloqueo excepcional. No sabe nada de reservas
   * existentes — eso lo valida booking-service con sus propios datos antes
   * de confirmar una reserva.
   */
  async checkAvailability(id, { date, startTime, endTime }) {
    const recurso = await this.recursoRepository.findById(id);
    if (!recurso) {
      throw new NotFoundError('Resource not found');
    }

    const estado = await this.estadoRepository.findById(recurso.statusId);
    if (!estado || !estado.isBookable) {
      return { available: false, reason: 'resource_not_bookable' };
    }

    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    const horario = await this.horarioRepository.findByResourceAndDay(id, dayOfWeek);
    if (!horario) {
      return { available: false, reason: 'closed_on_this_day' };
    }
    if (startTime < horario.openTime || endTime > horario.closeTime) {
      return { available: false, reason: 'outside_operating_hours' };
    }

    const blackout = await this.bloqueoRepository.findOverlapping(
      id,
      `${date} ${startTime}`,
      `${date} ${endTime}`,
    );
    if (blackout) {
      return { available: false, reason: 'blackout', blackoutReason: blackout.reason };
    }

    return { available: true };
  }

  async indexEntity(recurso, categoria) {
    try {
      await esClient.index({
        index: env.RESOURCE_INDEX,
        id: recurso.uuid,
        document: {
          type: 'recurso',
          id: recurso.id,
          nombre: recurso.name,
          codigo: recurso.code,
          estado: recurso.isActive ? 'active' : 'inactive',
          campusUuid: recurso.campusUuid,
          parent: { id: categoria.id, type: 'categoria', nombre: categoria.name },
          createdAt: recurso.createdAt,
          updatedAt: recurso.updatedAt,
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

module.exports = RecursoService;
