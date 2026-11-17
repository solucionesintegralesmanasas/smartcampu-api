const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const CategoriaService = require('../../src/modules/categoria/categoria.service');

function mockRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'ACADEMICO' }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'ACADEMICO' }),
    update: jest.fn().mockResolvedValue({ id: 1, code: 'ACADEMICO' }),
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

describe('CategoriaService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new CategoriaService(repo, mockRedis());
  });

  it('lanza ConflictError si el código ya existe', async () => {
    repo.findByCode.mockResolvedValue({ id: 2 });
    await expect(service.create({ code: 'ACADEMICO' })).rejects.toThrow(ConflictError);
  });

  it('crea la categoría si el código no existe', async () => {
    const result = await service.create({ code: 'ACADEMICO' });
    expect(repo.create).toHaveBeenCalledWith({ code: 'ACADEMICO' });
    expect(result).toEqual({ id: 1, code: 'ACADEMICO' });
  });

  it('lanza NotFoundError si la categoría no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findById(99)).rejects.toThrow(NotFoundError);
  });

  it('bloquea el borrado si tiene eventos activos', async () => {
    repo.countActiveEvents.mockResolvedValue(3);
    await expect(service.delete(1)).rejects.toThrow(ConflictError);
  });

  it('borra la categoría si no tiene eventos activos', async () => {
    await service.delete(1);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });
});
