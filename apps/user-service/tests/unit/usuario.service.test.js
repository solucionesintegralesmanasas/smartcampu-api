jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    search: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
  },
}));

const { esClient } = require('../../src/config/elasticsearch');
const { NotFoundError } = require('../../src/core/exceptions');
const UsuarioService = require('../../src/modules/usuario/usuario.service');

function mockRepository(overrides = {}) {
  return {
    findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 'u1', email: 'a@test.com', nombre: 'Ana Pérez', roles: ['STUDENT'], isActive: 1,
    }),
    update: jest.fn().mockResolvedValue({
      id: 1, uuid: 'u1', email: 'a@test.com', nombre: 'Ana Gómez', roles: ['STUDENT'], isActive: 1,
    }),
    replaceRoles: jest.fn().mockResolvedValue({
      id: 1, uuid: 'u1', email: 'a@test.com', nombre: 'Ana Pérez', roles: ['TEACHER'], isActive: 1,
    }),
    deactivate: jest.fn().mockResolvedValue(true),
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

describe('UsuarioService', () => {
  let repo;
  let redis;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = mockRepository();
    redis = mockRedis();
    service = new UsuarioService(repo, redis);
  });

  describe('findById', () => {
    it('retorna el usuario si existe', async () => {
      const result = await service.findById(1);
      expect(result.id).toBe(1);
      expect(repo.findById).toHaveBeenCalledWith(1);
    });

    it('lanza NotFoundError si no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundError);
    });

    it('usa la caché en la segunda llamada sin volver a golpear el repositorio', async () => {
      await service.findById(1);
      redis.get.mockResolvedValue(JSON.stringify({ id: 1, cached: true }));

      const result = await service.findById(1);

      expect(result).toEqual({ id: 1, cached: true });
    });
  });

  describe('update', () => {
    it('actualiza, reindexar en ES e invalida la caché', async () => {
      const result = await service.update(1, { firstName: 'Ana' });

      expect(result.nombre).toBe('Ana Gómez');
      expect(esClient.index).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('users:1');
    });

    it('lanza NotFoundError si el usuario no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('updateRoles', () => {
    it('reemplaza los roles, reindexar en ES e invalida la caché', async () => {
      const result = await service.updateRoles(1, ['TEACHER'], 2);

      expect(repo.replaceRoles).toHaveBeenCalledWith(1, ['TEACHER'], 2);
      expect(result.roles).toEqual(['TEACHER']);
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({ document: expect.objectContaining({ roles: ['TEACHER'] }) }),
      );
      expect(redis.del).toHaveBeenCalledWith('users:1');
    });

    it('lanza NotFoundError si el usuario no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.updateRoles(999, ['ADMIN'], 2)).rejects.toThrow(NotFoundError);
      expect(repo.replaceRoles).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('desactiva y elimina del índice de Elasticsearch', async () => {
      await service.deactivate(1);

      expect(repo.deactivate).toHaveBeenCalledWith(1);
      expect(esClient.delete).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1' }),
      );
    });

    it('lanza NotFoundError si el usuario no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.deactivate(999)).rejects.toThrow(NotFoundError);
      expect(repo.deactivate).not.toHaveBeenCalled();
    });
  });
});
