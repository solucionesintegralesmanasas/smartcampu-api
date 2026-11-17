const { ConflictError } = require('../../src/core/exceptions');
const EstadoService = require('../../src/modules/estado/estado.service');

function mockRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'pending' }),
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'pending' }),
    delete: jest.fn().mockResolvedValue(true),
    countActiveRequests: jest.fn().mockResolvedValue(0),
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
    await expect(service.create({ code: 'pending' })).rejects.toThrow(ConflictError);
  });

  it('bloquea el borrado si está asignado a solicitudes activas', async () => {
    repo.countActiveRequests.mockResolvedValue(2);
    await expect(service.delete(1)).rejects.toThrow(ConflictError);
  });
});
