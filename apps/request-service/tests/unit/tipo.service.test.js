const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const TipoService = require('../../src/modules/tipo/tipo.service');

function mockTipoRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'CERT-NOTAS' }),
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'CERT-NOTAS' }),
    delete: jest.fn().mockResolvedValue(true),
    countActiveRequests: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function mockCategoriaRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, name: 'Certificados' }),
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
  let tipoRepo;
  let categoriaRepo;
  let service;

  beforeEach(() => {
    tipoRepo = mockTipoRepository();
    categoriaRepo = mockCategoriaRepository();
    service = new TipoService(tipoRepo, categoriaRepo, mockRedis());
  });

  it('lanza NotFoundError si la categoría no existe', async () => {
    categoriaRepo.findById.mockResolvedValue(null);
    await expect(service.create({ categoryId: 999, code: 'X' })).rejects.toThrow(NotFoundError);
    expect(tipoRepo.create).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si el código ya existe', async () => {
    tipoRepo.findByCode.mockResolvedValue({ id: 2 });
    await expect(service.create({ categoryId: 1, code: 'CERT-NOTAS' })).rejects.toThrow(ConflictError);
  });

  it('bloquea el borrado si tiene solicitudes activas', async () => {
    tipoRepo.countActiveRequests.mockResolvedValue(3);
    await expect(service.delete(1)).rejects.toThrow(ConflictError);
  });
});
