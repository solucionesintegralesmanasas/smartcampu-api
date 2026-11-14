const { NotFoundError } = require('../../core/exceptions');
const { buildPaginatedResult, parsePagination } = require('../../core/helpers/pagination.helper');

const { buildSearchDocument } = require('./resources.search-document');

class ResourcesService {
  /**
   * @param {import('./resources.repository')} resourcesRepository
   * @param {import('../../jobs/producers/resource.producer')} resourceProducer
   */
  constructor(resourcesRepository, resourceProducer) {
    this.resourcesRepository = resourcesRepository;
    this.resourceProducer = resourceProducer;
  }

  async findAll(query = {}) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await this.resourcesRepository.findAll({
      limit,
      offset,
      search: query.search,
      categoriaId: query.categoriaId,
      estadoId: query.estadoId,
    });
    return buildPaginatedResult(rows, total, page, limit);
  }

  async findOne(identifier) {
    const recurso = await this.resourcesRepository.findOne(identifier);
    if (!recurso || !recurso.activo) {
      throw new NotFoundError(`Recurso con ID ${identifier} no encontrado`);
    }
    return recurso;
  }

  async create(dto) {
    const id = await this.resourcesRepository.create(dto);
    const recurso = await this.resourcesRepository.findOne(id);
    this.resourceProducer.enqueueSync('index', buildSearchDocument(recurso));
    return recurso;
  }

  async update(identifier, dto) {
    const existing = await this.findExisting(identifier);
    await this.resourcesRepository.update(existing.id, dto);
    const recurso = await this.resourcesRepository.findOne(existing.id);
    this.resourceProducer.enqueueSync('index', buildSearchDocument(recurso));
    return recurso;
  }

  async remove(identifier) {
    const existing = await this.findExisting(identifier);
    await this.resourcesRepository.softDelete(existing.id);
    this.resourceProducer.enqueueSync('delete', { id: existing.id });
  }

  async findExisting(identifier) {
    const recurso = await this.resourcesRepository.findOne(identifier);
    if (!recurso) {
      throw new NotFoundError(`Recurso con ID ${identifier} no encontrado`);
    }
    return recurso;
  }
}

module.exports = ResourcesService;
