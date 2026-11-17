jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const SedeService = require('../../src/modules/sede/sede.service');

function mockRepository(overrides = {}) {
  return {
    findByName: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 's1', name: 'Sede Bogotá', isActive: 1,
    }),
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 's1', name: 'Sede Bogotá', isActive: 1,
    }),
    update: jest.fn().mockResolvedValue({ id: 1, name: 'Sede Bogotá Norte' }),
    delete: jest.fn().mockResolvedValue(true),
    countActiveFaculties: jest.fn().mockResolvedValue(0),
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

describe('SedeService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new SedeService(repo, mockRedis());
  });

  describe('create', () => {
    it('lanza ConflictError si el nombre ya existe', async () => {
      repo.findByName.mockResolvedValue({ id: 2 });
      await expect(service.create({ name: 'Sede Bogotá' })).rejects.toThrow(ConflictError);
    });

    it('crea la sede si el nombre no existe', async () => {
      const result = await service.create({ name: 'Sede Bogotá' });
      expect(result.id).toBe(1);
    });
  });

  describe('delete', () => {
    it('bloquea el borrado si tiene facultades activas', async () => {
      repo.countActiveFaculties.mockResolvedValue(2);
      await expect(service.delete(1)).rejects.toThrow(ConflictError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('borra la sede si no tiene facultades activas', async () => {
      await service.delete(1);
      expect(repo.delete).toHaveBeenCalledWith(1);
    });

    it('lanza NotFoundError si la sede no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundError);
    });
  });
});
