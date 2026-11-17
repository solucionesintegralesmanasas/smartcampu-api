const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const PermisoService = require('../../src/modules/permiso/permiso.service');

function mockRepository(overrides = {}) {
  return {
    findByName: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, name: 'academic.students.read' }),
    findById: jest.fn().mockResolvedValue({ id: 1, name: 'academic.students.read' }),
    update: jest.fn().mockResolvedValue({ id: 1, name: 'academic.students.read', description: 'x' }),
    delete: jest.fn().mockResolvedValue(true),
    countRolesWithPermission: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('PermisoService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new PermisoService(repo);
  });

  describe('create', () => {
    it('crea el permiso si el nombre no existe', async () => {
      const result = await service.create({ name: 'academic.students.read' });
      expect(result.id).toBe(1);
    });

    it('lanza ConflictError si el nombre ya existe', async () => {
      repo.findByName.mockResolvedValue({ id: 2 });
      await expect(service.create({ name: 'academic.students.read' })).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe('delete', () => {
    it('lanza NotFoundError si el permiso no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundError);
    });

    it('bloquea el borrado si está asignado a roles', async () => {
      repo.countRolesWithPermission.mockResolvedValue(2);
      await expect(service.delete(1)).rejects.toThrow(ConflictError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('borra el permiso si no está asignado a ningún rol', async () => {
      await service.delete(1);
      expect(repo.delete).toHaveBeenCalledWith(1);
    });
  });
});
