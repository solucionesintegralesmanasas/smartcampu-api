const { ConflictError, ForbiddenError, NotFoundError } = require('../../src/core/exceptions');
const RolService = require('../../src/modules/rol/rol.service');

function mockRolRepository(overrides = {}) {
  return {
    findByName: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 1, name: 'COORDINADOR', isSystem: 0,
    }),
    findById: jest.fn().mockResolvedValue({
      id: 1, name: 'COORDINADOR', isSystem: 0,
    }),
    update: jest.fn().mockResolvedValue({ id: 1, name: 'COORDINADOR_V2', isSystem: 0 }),
    delete: jest.fn().mockResolvedValue(true),
    countUsersWithRole: jest.fn().mockResolvedValue(0),
    listPermissions: jest.fn().mockResolvedValue([]),
    assignPermission: jest.fn().mockResolvedValue(undefined),
    revokePermission: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockPermisoRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 5, name: 'academic.students.read' }),
    ...overrides,
  };
}

describe('RolService', () => {
  let rolRepo;
  let permisoRepo;
  let service;

  beforeEach(() => {
    rolRepo = mockRolRepository();
    permisoRepo = mockPermisoRepository();
    service = new RolService(rolRepo, permisoRepo);
  });

  describe('create', () => {
    it('crea el rol si el nombre no existe', async () => {
      const result = await service.create({ name: 'COORDINADOR' });
      expect(result.name).toBe('COORDINADOR');
    });

    it('lanza ConflictError si el nombre ya existe', async () => {
      rolRepo.findByName.mockResolvedValue({ id: 2, name: 'COORDINADOR' });
      await expect(service.create({ name: 'COORDINADOR' })).rejects.toThrow(ConflictError);
    });
  });

  describe('update', () => {
    it('bloquea el renombrado de un rol de sistema', async () => {
      rolRepo.findById.mockResolvedValue({ id: 1, name: 'STUDENT', isSystem: 1 });

      await expect(service.update(1, { name: 'ALUMNO' })).rejects.toThrow(ForbiddenError);
      expect(rolRepo.update).not.toHaveBeenCalled();
    });

    it('permite editar la descripción de un rol de sistema', async () => {
      rolRepo.findById.mockResolvedValue({ id: 1, name: 'STUDENT', isSystem: 1 });

      await service.update(1, { description: 'Rol de estudiante' });

      expect(rolRepo.update).toHaveBeenCalledWith(1, { description: 'Rol de estudiante' });
    });

    it('lanza ConflictError si el nuevo nombre ya existe en otro rol', async () => {
      rolRepo.findByName.mockResolvedValue({ id: 2, name: 'OTRO' });

      await expect(service.update(1, { name: 'OTRO' })).rejects.toThrow(ConflictError);
    });
  });

  describe('delete', () => {
    it('bloquea el borrado de un rol de sistema', async () => {
      rolRepo.findById.mockResolvedValue({ id: 1, name: 'ADMIN', isSystem: 1 });

      await expect(service.delete(1)).rejects.toThrow(ForbiddenError);
      expect(rolRepo.delete).not.toHaveBeenCalled();
    });

    it('bloquea el borrado si el rol está asignado a usuarios activos', async () => {
      rolRepo.countUsersWithRole.mockResolvedValue(3);

      await expect(service.delete(1)).rejects.toThrow(ConflictError);
      expect(rolRepo.delete).not.toHaveBeenCalled();
    });

    it('borra el rol si no es de sistema y no tiene usuarios asignados', async () => {
      await service.delete(1);
      expect(rolRepo.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('assignPermission', () => {
    it('lanza NotFoundError si el permiso no existe', async () => {
      permisoRepo.findById.mockResolvedValue(null);

      await expect(service.assignPermission(1, 99)).rejects.toThrow(NotFoundError);
      expect(rolRepo.assignPermission).not.toHaveBeenCalled();
    });

    it('asigna el permiso si existe', async () => {
      await service.assignPermission(1, 5);
      expect(rolRepo.assignPermission).toHaveBeenCalledWith(1, 5);
    });
  });
});
