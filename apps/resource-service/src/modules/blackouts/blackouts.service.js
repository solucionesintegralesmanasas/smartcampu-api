const { NotFoundError } = require('../../core/exceptions');
const { buildPaginatedResult, parsePagination } = require('../../core/helpers/pagination.helper');
const { toMysqlDateTime } = require('../../core/helpers/time.helper');

class BlackoutsService {
  /**
   * @param {import('./blackouts.repository')} blackoutsRepository
   * @param {import('../resources/resources.repository')} resourcesRepository
   */
  constructor(blackoutsRepository, resourcesRepository) {
    this.blackoutsRepository = blackoutsRepository;
    this.resourcesRepository = resourcesRepository;
  }

  async findAll(resourceIdentifier, query = {}) {
    const recurso = await this.findResource(resourceIdentifier);
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await this.blackoutsRepository.findByResource(recurso.id, {
      limit,
      offset,
    });
    return buildPaginatedResult(rows, total, page, limit);
  }

  async create(resourceIdentifier, dto, user) {
    const recurso = await this.findResource(resourceIdentifier);
    const id = await this.blackoutsRepository.create({
      resourceId: recurso.id,
      inicio: toMysqlDateTime(dto.inicio),
      fin: toMysqlDateTime(dto.fin),
      motivo: dto.motivo,
      // El JWT de auth-service lleva `sub` numérico; `uuid` solo existe si el token lo incluye.
      createdByUuid: user.uuid || String(user.sub),
    });
    return this.blackoutsRepository.findOne(recurso.id, id);
  }

  async remove(resourceIdentifier, bloqueoIdentifier) {
    const recurso = await this.findResource(resourceIdentifier);
    const bloqueo = await this.blackoutsRepository.findOne(recurso.id, bloqueoIdentifier);
    if (!bloqueo) {
      throw new NotFoundError(`Bloqueo con ID ${bloqueoIdentifier} no encontrado`);
    }
    await this.blackoutsRepository.delete(bloqueo.id);
  }

  async findResource(identifier) {
    const recurso = await this.resourcesRepository.findOne(identifier);
    if (!recurso) {
      throw new NotFoundError(`Recurso con ID ${identifier} no encontrado`);
    }
    return recurso;
  }
}

module.exports = BlackoutsService;
