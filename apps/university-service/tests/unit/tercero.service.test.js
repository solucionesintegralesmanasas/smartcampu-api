const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const TerceroService = require('../../src/modules/tercero/tercero.service');

function mockRepository(overrides = {}) {
  return {
    findByDocument: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 't1', firstName: 'Ana', lastName: 'Pérez',
    }),
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 't1', firstName: 'Ana', lastName: 'Pérez',
    }),
    update: jest.fn().mockResolvedValue({ id: 1, firstName: 'Ana María' }),
    delete: jest.fn().mockResolvedValue(true),
    countActiveRoles: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function mockRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

describe('TerceroService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new TerceroService(repo, mockRedis());
  });

  describe('create', () => {
    it('lanza ConflictError si ya existe una persona con ese documento', async () => {
      repo.findByDocument.mockResolvedValue({ id: 2 });
      await expect(
        service.create({ documentTypeCode: 'CC', documentNumber: '123' }),
      ).rejects.toThrow(ConflictError);
    });

    it('crea la persona si el documento no existe', async () => {
      const result = await service.create({ documentTypeCode: 'CC', documentNumber: '123' });
      expect(result.id).toBe(1);
    });
  });

  describe('delete', () => {
    it('bloquea el borrado si está vinculada a un estudiante/docente activo', async () => {
      repo.countActiveRoles.mockResolvedValue(1);
      await expect(service.delete(1)).rejects.toThrow(ConflictError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('borra la persona si no está vinculada a ningún rol activo', async () => {
      await service.delete(1);
      expect(repo.delete).toHaveBeenCalledWith(1);
    });

    it('lanza NotFoundError si la persona no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundError);
    });
  });
});
