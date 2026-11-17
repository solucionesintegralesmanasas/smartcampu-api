const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const TipoService = require('../../src/modules/tipo/tipo.service');

function mockRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'QUEJA' }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'QUEJA' }),
    update: jest.fn().mockResolvedValue({ id: 1, code: 'QUEJA' }),
    delete: jest.fn().mockResolvedValue(true),
    countActivePqrs: jest.fn().mockResolvedValue(0),
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

describe('TipoService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new TipoService(repo, mockRedis());
  });

  it('lanza ConflictError si el código ya existe', async () => {
    repo.findByCode.mockResolvedValue({ id: 2 });
    await expect(service.create({ code: 'QUEJA' })).rejects.toThrow(ConflictError);
  });

  it('crea el tipo si el código no existe', async () => {
    const result = await service.create({ code: 'QUEJA' });
    expect(repo.create).toHaveBeenCalledWith({ code: 'QUEJA' });
    expect(result).toEqual({ id: 1, code: 'QUEJA' });
  });

  it('lanza NotFoundError si el tipo no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findById(99)).rejects.toThrow(NotFoundError);
  });

  it('bloquea el borrado si tiene PQRS activas', async () => {
    repo.countActivePqrs.mockResolvedValue(1);
    await expect(service.delete(1)).rejects.toThrow(ConflictError);
  });

  it('borra el tipo si no tiene PQRS activas', async () => {
    await service.delete(1);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });
});
