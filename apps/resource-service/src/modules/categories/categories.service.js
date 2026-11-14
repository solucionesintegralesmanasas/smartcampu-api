const { ConflictError, NotFoundError } = require('../../core/exceptions');
const { buildPaginatedResult, parsePagination } = require('../../core/helpers/pagination.helper');

class CategoriesService {
  /**
   * @param {import('./categories.repository')} categoriesRepository
   */
  constructor(categoriesRepository) {
    this.categoriesRepository = categoriesRepository;
  }

  async findAll(query = {}) {
    const { page, limit, offset } = parsePagination(query);
    const { rows, total } = await this.categoriesRepository.findAll({ limit, offset });
    return buildPaginatedResult(rows, total, page, limit);
  }

  async findOne(identifier) {
    const categoria = await this.categoriesRepository.findOne(identifier);
    if (!categoria || !categoria.activo) {
      throw new NotFoundError(`Categoría con ID ${identifier} no encontrada`);
    }
    return categoria;
  }

  async create(dto) {
    await this.assertNoConflicts(dto.codigo, dto.nombre);
    const id = await this.categoriesRepository.create(dto);
    return this.categoriesRepository.findOne(id);
  }

  async update(identifier, dto) {
    const existing = await this.findExisting(identifier);
    const codigo = dto.codigo ?? existing.codigo;
    const nombre = dto.nombre ?? existing.nombre;
    await this.assertNoConflicts(codigo, nombre, existing.id);
    await this.categoriesRepository.update(existing.id, dto);
    return this.categoriesRepository.findOne(existing.id);
  }

  async remove(identifier) {
    const existing = await this.findExisting(identifier);
    await this.categoriesRepository.softDelete(existing.id);
  }

  async findExisting(identifier) {
    const categoria = await this.categoriesRepository.findOne(identifier);
    if (!categoria) {
      throw new NotFoundError(`Categoría con ID ${identifier} no encontrada`);
    }
    return categoria;
  }

  async assertNoConflicts(codigo, nombre, excludeId = null) {
    const conflicts = await this.categoriesRepository.findConflicts(codigo, nombre);
    const hasConflict = conflicts.some((row) => row.id !== excludeId);
    if (hasConflict) {
      throw new ConflictError(`Ya existe una categoría con el código '${codigo}' o el nombre '${nombre}'`);
    }
  }
}

module.exports = CategoriesService;
