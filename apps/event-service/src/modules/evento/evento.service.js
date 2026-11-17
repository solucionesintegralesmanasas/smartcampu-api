const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const {
  ConflictError, ForbiddenError, NotFoundError,
} = require('../../core/exceptions');
const { safeCacheGet, safeCacheSet, safeCacheInvalidate } = require('../../core/helpers/cache.helper');

const ADMIN_ROLES = ['SUPERADMIN', 'ADMIN', 'STAFF'];

function isAdmin(user) {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

class EventoService {
  constructor(
    eventoRepository,
    categoriaRepository,
    estadoRepository,
    redisClient,
    notificationProducer = null,
  ) {
    this.eventoRepository = eventoRepository;
    this.categoriaRepository = categoriaRepository;
    this.estadoRepository = estadoRepository;
    this.redisClient = redisClient;
    this.notificationProducer = notificationProducer;
    this.listKeys = new Set();
  }

  trackListKey(cacheKey) {
    this.listKeys.add(cacheKey);
  }

  async getCache(key) {
    return safeCacheGet(this.redisClient, key);
  }

  async create(dto, organizer) {
    const categoria = await this.categoriaRepository.findById(dto.categoryId);
    if (!categoria) {
      throw new NotFoundError('Category not found');
    }

    const draftStatus = await this.estadoRepository.findByCode('draft');
    if (!draftStatus) {
      throw new NotFoundError("Event status 'draft' is not configured");
    }

    const slug = `${slugify(dto.title)}-${Date.now().toString(36)}`;

    const evento = await this.eventoRepository.create({
      ...dto,
      slug,
      statusId: draftStatus.id,
      organizerUuid: organizer.uuid,
      organizerName: organizer.nombre || organizer.uuid,
    });

    await this.indexEntity(evento);
    await this.invalidateCache();
    return evento;
  }

  async findAll({
    page = 1, limit = 10, categoryId, statusId, organizerUuid,
  } = {}) {
    const cacheKey = `eventos:all:${page}:${limit}:${categoryId ?? ''}:${statusId ?? ''}:${organizerUuid ?? ''}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const result = await this.eventoRepository.findAll({
      page, limit, categoryId, statusId, organizerUuid,
    });
    await safeCacheSet(this.redisClient, cacheKey, result, env.EVENT_CACHE_TTL);
    this.trackListKey(cacheKey);
    return result;
  }

  async findById(id) {
    const cacheKey = `eventos:${id}`;
    const cached = await this.getCache(cacheKey);
    if (cached) return cached;

    const evento = await this.eventoRepository.findById(id);
    if (!evento) {
      throw new NotFoundError('Event not found');
    }

    await safeCacheSet(this.redisClient, cacheKey, evento, env.EVENT_CACHE_TTL);
    return evento;
  }

  assertCanManage(evento, actor) {
    if (evento.organizerUuid !== actor.uuid && !isAdmin(actor)) {
      throw new ForbiddenError('Only the organizer or staff can manage this event');
    }
  }

  async update(id, dto, actor) {
    const evento = await this.findById(id);
    this.assertCanManage(evento, actor);

    const updated = await this.eventoRepository.update(id, dto);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`eventos:${id}`]);
    return updated;
  }

  async delete(id, actor) {
    const evento = await this.findById(id);
    this.assertCanManage(evento, actor);

    await this.eventoRepository.delete(id);

    try {
      await esClient.delete({ index: env.EVENT_INDEX, id: evento.uuid });
    } catch (error) {
      // ES delete is non-blocking
    }

    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`eventos:${id}`]);
  }

  async transition(id, actor, { fromCodes, toCode }) {
    const evento = await this.findById(id);
    this.assertCanManage(evento, actor);

    const currentStatus = await this.estadoRepository.findById(evento.statusId);
    if (!fromCodes.includes(currentStatus.code)) {
      throw new ConflictError(`Cannot transition from '${currentStatus.code}' to '${toCode}'`);
    }

    const nextStatus = await this.estadoRepository.findByCode(toCode);
    if (!nextStatus) {
      throw new NotFoundError(`Event status '${toCode}' is not configured`);
    }

    const updated = await this.eventoRepository.updateStatus(id, nextStatus.id);
    await this.indexEntity(updated);
    await this.invalidateCache();
    await safeCacheInvalidate(this.redisClient, [`eventos:${id}`]);
    return updated;
  }

  async publish(id, actor) {
    const evento = await this.transition(id, actor, { fromCodes: ['draft'], toCode: 'published' });
    if (this.notificationProducer) {
      try {
        await this.notificationProducer.notify('evento_publicado', {
          recipientUuid: evento.organizerUuid,
          recipientName: evento.organizerName,
          entityId: evento.id,
          entityUuid: evento.uuid,
          referenceLabel: evento.title,
        });
      } catch (error) {
        // La notificación es best-effort: nunca debe tumbar la publicación.
      }
    }
    return evento;
  }

  async start(id, actor) {
    return this.transition(id, actor, { fromCodes: ['published'], toCode: 'ongoing' });
  }

  async complete(id, actor) {
    return this.transition(id, actor, { fromCodes: ['ongoing'], toCode: 'completed' });
  }

  async cancel(id, actor) {
    return this.transition(id, actor, {
      fromCodes: ['draft', 'published', 'ongoing'],
      toCode: 'cancelled',
    });
  }

  async indexEntity(evento) {
    try {
      await esClient.index({
        index: env.EVENT_INDEX,
        id: evento.uuid,
        document: {
          id: evento.id,
          uuid: evento.uuid,
          title: evento.title,
          organizerUuid: evento.organizerUuid,
          campusUuid: evento.campusUuid,
          estado: String(evento.statusId),
          startsAt: evento.startsAt,
          endsAt: evento.endsAt,
          createdAt: evento.createdAt,
          updatedAt: evento.updatedAt,
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

module.exports = EventoService;
