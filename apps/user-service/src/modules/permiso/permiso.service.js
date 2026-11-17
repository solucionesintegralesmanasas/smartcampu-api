const { ConflictError, NotFoundError } = require('../../core/exceptions');

class PermisoService {
  constructor(permisoRepository) {
    this.permisoRepository = permisoRepository;
  }

  async create(permisoDto) {
    const existing = await this.permisoRepository.findByName(permisoDto.name);
    if (existing) {
      throw new ConflictError('Permission name already exists');
    }
    return this.permisoRepository.create(permisoDto);
  }

  async findAll(query) {
    return this.permisoRepository.findAll(query);
  }

  async findById(id) {
    const permission = await this.permisoRepository.findById(id);
    if (!permission) {
      throw new NotFoundError('Permission not found');
    }
    return permission;
  }

  async update(id, permisoDto) {
    await this.findById(id);
    return this.permisoRepository.update(id, permisoDto);
  }

  async delete(id) {
    await this.findById(id);

    const rolesWithPermission = await this.permisoRepository.countRolesWithPermission(id);
    if (rolesWithPermission > 0) {
      throw new ConflictError('Cannot delete permission: it is assigned to roles');
    }

    await this.permisoRepository.delete(id);
  }
}

module.exports = PermisoService;
