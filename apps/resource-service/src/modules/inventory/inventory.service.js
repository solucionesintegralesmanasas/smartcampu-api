const { NotFoundError } = require('../../core/exceptions');
const { buildPaginatedResult, parsePagination } = require('../../core/helpers/pagination.helper');

class InventoryService {
  /**
   * @param {import('./inventory.repository')} inventoryRepository
   * @param {import('../resources/resources.repository')} resourcesRepository
   */
  constructor(inventoryRepository, resourcesRepository) {
    this.inventoryRepository = inventoryRepository;
    this.resourcesRepository = resourcesRepository;
  }

  async findAll(resourceIdentifier, query = {}) {
    const recurso = await this.findResource(resourceIdentifier);
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await this.inventoryRepository.findByResource(recurso.id, {
      limit,
      offset,
    });
    return buildPaginatedResult(rows, total, page, limit);
  }

  async findOne(resourceIdentifier, itemIdentifier) {
    const recurso = await this.findResource(resourceIdentifier);
    return this.findItem(recurso.id, itemIdentifier);
  }

  async create(resourceIdentifier, dto) {
    const recurso = await this.findResource(resourceIdentifier);
    const id = await this.inventoryRepository.create(recurso.id, dto);
    return this.inventoryRepository.findOne(recurso.id, id);
  }

  async update(resourceIdentifier, itemIdentifier, dto) {
    const recurso = await this.findResource(resourceIdentifier);
    const item = await this.findItem(recurso.id, itemIdentifier);
    await this.inventoryRepository.update(item.id, dto);
    return this.inventoryRepository.findOne(recurso.id, item.id);
  }

  async remove(resourceIdentifier, itemIdentifier) {
    const recurso = await this.findResource(resourceIdentifier);
    const item = await this.findItem(recurso.id, itemIdentifier);
    await this.inventoryRepository.softDelete(item.id);
  }

  async findResource(identifier) {
    const recurso = await this.resourcesRepository.findOne(identifier);
    if (!recurso) {
      throw new NotFoundError(`Recurso con ID ${identifier} no encontrado`);
    }
    return recurso;
  }

  async findItem(resourceId, identifier) {
    const item = await this.inventoryRepository.findOne(resourceId, identifier);
    if (!item || !item.activo) {
      throw new NotFoundError(`Elemento de inventario con ID ${identifier} no encontrado`);
    }
    return item;
  }
}

module.exports = InventoryService;
