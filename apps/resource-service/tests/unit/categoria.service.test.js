const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const CategoriaService = require('../../src/modules/categoria/categoria.service');

function mockRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'AULA', name: 'Aulas' }),
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'AULA', name: 'Aulas' }),
    update: jest.fn().mockResolvedValue({ id: 1, name: 'Aulas y Salones' }),
    delete: jest.fn().mockResolvedValue(true),
    countActiveResources: jest.fn().mockResolvedValue(0),
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
    await expect(service.create({ code: 'AULA' })).rejects.toThrow(ConflictError);
  });

  it('crea la categoría si el código no existe', async () => {
    const result = await service.create({ code: 'AULA', name: 'Aulas' });
    expect(result.id).toBe(1);
  });

  it('bloquea el borrado si tiene recursos activos', async () => {
    repo.countActiveResources.mockResolvedValue(3);
    await expect(service.delete(1)).rejects.toThrow(ConflictError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('borra la categoría si no tiene recursos activos', async () => {
    await service.delete(1);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });

  it('lanza NotFoundError si no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findById(999)).rejects.toThrow(NotFoundError);
  });
});
