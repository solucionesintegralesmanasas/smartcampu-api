const { ConflictError } = require('../../src/core/exceptions');
const TipoService = require('../../src/modules/tipo/tipo.service');

function mockRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'ACADEMICO' }),
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'ACADEMICO' }),
    delete: jest.fn().mockResolvedValue(true),
    countActiveBookings: jest.fn().mockResolvedValue(0),
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
    await expect(service.create({ code: 'ACADEMICO' })).rejects.toThrow(ConflictError);
  });

  it('bloquea el borrado si tiene reservas activas', async () => {
    repo.countActiveBookings.mockResolvedValue(1);
    await expect(service.delete(1)).rejects.toThrow(ConflictError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('borra el tipo si no tiene reservas activas', async () => {
    await service.delete(1);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });
});
