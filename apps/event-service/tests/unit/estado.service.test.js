const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const EstadoService = require('../../src/modules/estado/estado.service');

function mockRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'draft' }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'draft' }),
    delete: jest.fn().mockResolvedValue(true),
    countActiveEvents: jest.fn().mockResolvedValue(0),
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

describe('EstadoService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new EstadoService(repo, mockRedis());
  });

  it('lanza ConflictError si el código ya existe', async () => {
    repo.findByCode.mockResolvedValue({ id: 2 });
    await expect(service.create({ code: 'draft' })).rejects.toThrow(ConflictError);
  });

  it('lanza NotFoundError si el estado no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findById(99)).rejects.toThrow(NotFoundError);
  });

  it('bloquea el borrado si está asignado a eventos activos', async () => {
    repo.countActiveEvents.mockResolvedValue(2);
    await expect(service.delete(1)).rejects.toThrow(ConflictError);
  });

  it('borra el estado si no tiene eventos activos', async () => {
    await service.delete(1);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });
});
