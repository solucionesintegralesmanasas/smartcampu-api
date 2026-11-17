const { ConflictError, ForbiddenError, NotFoundError } = require('../../core/exceptions');

class RolService {
  constructor(rolRepository, permisoRepository) {
    this.rolRepository = rolRepository;
    this.permisoRepository = permisoRepository;
  }

  async create(rolDto) {
    const existing = await this.rolRepository.findByName(rolDto.name);
    if (existing) {
      throw new ConflictError('Role name already exists');
    }
    return this.rolRepository.create(rolDto);
  }

  async findAll(query) {
    return this.rolRepository.findAll(query);
  }

  async findById(id) {
    const role = await this.rolRepository.findById(id);
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    return role;
  }

  async update(id, rolDto) {
    const existing = await this.findById(id);

    // Renombrar un rol de sistema (SUPERADMIN, ADMIN, STAFF, TEACHER,
    // STUDENT) rompería silenciosamente el orden de precedencia hardcodeado
    // en auth-service (selectUserFields FIELD(...)), que decide el rol
    // principal del JWT. Se permite editar la descripción, no el nombre.
    if (existing.isSystem && rolDto.name && rolDto.name !== existing.name) {
      throw new ForbiddenError('No se puede renombrar un rol de sistema');
    }

    if (rolDto.name && rolDto.name !== existing.name) {
      const duplicate = await this.rolRepository.findByName(rolDto.name);
      if (duplicate) {
        throw new ConflictError('Role name already exists');
      }
    }

    return this.rolRepository.update(id, rolDto);
  }

  async delete(id) {
    const existing = await this.findById(id);

    if (existing.isSystem) {
      throw new ForbiddenError('No se puede eliminar un rol de sistema');
    }

    const usersWithRole = await this.rolRepository.countUsersWithRole(id);
    if (usersWithRole > 0) {
      throw new ConflictError('Cannot delete role: it is assigned to active users');
    }

    await this.rolRepository.delete(id);
  }

  async listPermissions(id) {
    await this.findById(id);
    return this.rolRepository.listPermissions(id);
  }

  async assignPermission(id, permissionId) {
    await this.findById(id);
    const permission = await this.permisoRepository.findById(permissionId);
    if (!permission) {
      throw new NotFoundError('Permission not found');
    }
    await this.rolRepository.assignPermission(id, permissionId);
    return this.rolRepository.listPermissions(id);
  }

  async revokePermission(id, permissionId) {
    await this.findById(id);
    await this.rolRepository.revokePermission(id, permissionId);
    return this.rolRepository.listPermissions(id);
  }
}

module.exports = RolService;
