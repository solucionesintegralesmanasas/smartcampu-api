const { ConflictError } = require('../../src/core/exceptions');
const CategoriaService = require('../../src/modules/categoria/categoria.service');

function mockRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'CERTIFICADOS' }),
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'CERTIFICADOS' }),
    delete: jest.fn().mockResolvedValue(true),
    countActiveTypes: jest.fn().mockResolvedValue(0),
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
    await expect(service.create({ code: 'CERTIFICADOS' })).rejects.toThrow(ConflictError);
  });

  it('bloquea el borrado si tiene tipos de solicitud activos', async () => {
    repo.countActiveTypes.mockResolvedValue(1);
    await expect(service.delete(1)).rejects.toThrow(ConflictError);
  });

  it('borra la categoría si no tiene tipos activos', async () => {
    await service.delete(1);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });
});
