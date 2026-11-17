const { esClient } = require('../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const CampusService = require('../../src/modules/campus/campus.service');

describe('CampusService (Unit Tests)', () => {
  let mockCampusRepo;
  let mockRedisClient;
  let campusService;

  const existing = {
    id: 1,
    uuid: 'uuid-robledo',
    name: 'Campus Robledo',
    address: 'Carrera 80 # 65-223',
    phone: '+57 604 4309000',
    cityId: 1,
    active: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCampusRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCityId: jest.fn(),
      findByName: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    campusService = new CampusService(mockCampusRepo, mockRedisClient);
  });

  describe('create', () => {
    it('debe registrar un campus exitosamente', async () => {
      const dto = { ...existing, id: undefined };
      mockCampusRepo.findByName.mockResolvedValue(null);
      mockCampusRepo.create.mockResolvedValue(existing);

      const result = await campusService.create(dto);

      expect(mockCampusRepo.findByName).toHaveBeenCalledWith('Campus Robledo');
      expect(mockCampusRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('id', 1);
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'campuses', id: '1' }),
      );
    });

    it('debe lanzar ConflictError si el nombre del campus ya existe', async () => {
      mockCampusRepo.findByName.mockResolvedValue(existing);

      await expect(campusService.create({ cityId: 1, name: 'Campus Robledo' }))
        .rejects.toThrow(ConflictError);
      expect(mockCampusRepo.create).not.toHaveBeenCalled();
    });

    it('no debe fallar si Elasticsearch no responde al indexar', async () => {
      esClient.index.mockRejectedValueOnce(new Error('ES caído'));
      mockCampusRepo.findByName.mockResolvedValue(null);
      mockCampusRepo.create.mockResolvedValue(existing);

      await expect(campusService.create({ cityId: 1, name: 'Campus Robledo' }))
        .resolves.toHaveProperty('id', 1);
    });
  });

  describe('findAll', () => {
    it('debe listar campus de forma paginada desde el repositorio', async () => {
      const paginated = {
        data: [existing],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      };
      mockCampusRepo.findAll.mockResolvedValue(paginated);

      const result = await campusService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(paginated);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'campuses:all:1:10',
        JSON.stringify(paginated),
        3600,
      );
    });

    it('debe retornar desde la caché si existe', async () => {
      const cached = { data: [existing], pagination: { page: 1, limit: 10 } };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      await expect(campusService.findAll({ page: 1, limit: 10 })).resolves.toEqual(cached);
      expect(mockCampusRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findByCityId', () => {
    it('debe retornar las sedes de una ciudad específica', async () => {
      mockCampusRepo.findByCityId.mockResolvedValue([existing]);

      const result = await campusService.findByCityId(1);

      expect(result).toEqual([existing]);
      expect(mockCampusRepo.findByCityId).toHaveBeenCalledWith(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'campuses:city:1',
        JSON.stringify([existing]),
        3600,
      );
    });

    it('debe retornar desde la caché si existe', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify([existing]));

      await expect(campusService.findByCityId(1)).resolves.toEqual([existing]);
      expect(mockCampusRepo.findByCityId).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('debe retornar el campus si existe', async () => {
      mockCampusRepo.findById.mockResolvedValue(existing);

      await expect(campusService.findById(1)).resolves.toEqual(existing);
    });

    it('debe retornar el campus desde la caché si existe', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existing));

      await expect(campusService.findById(1)).resolves.toEqual(existing);
      expect(mockCampusRepo.findById).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si el campus no existe', async () => {
      mockCampusRepo.findById.mockResolvedValue(null);

      await expect(campusService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('debe actualizar el campus exitosamente', async () => {
      const updateDto = { address: 'Nueva dirección # 12-34' };
      mockCampusRepo.findById.mockResolvedValue(existing);
      mockCampusRepo.update.mockResolvedValue({ ...existing, ...updateDto });

      const result = await campusService.update(1, updateDto);

      expect(result.address).toBe('Nueva dirección # 12-34');
      expect(mockCampusRepo.update).toHaveBeenCalledWith(1, updateDto);
      expect(mockRedisClient.del).toHaveBeenCalledWith('campuses:1');
    });

    it('debe validar el nombre cuando cambia', async () => {
      mockCampusRepo.findById.mockResolvedValue(existing);
      mockCampusRepo.findByName.mockResolvedValue({ id: 2, name: 'Campus Otro' });

      await expect(campusService.update(1, { name: 'Campus Otro' })).rejects.toThrow(ConflictError);
      expect(mockCampusRepo.update).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si el campus no existe', async () => {
      mockCampusRepo.findById.mockResolvedValue(null);

      await expect(campusService.update(999, { name: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('debe eliminar la sede si existe', async () => {
      mockCampusRepo.findById.mockResolvedValue(existing);
      mockCampusRepo.delete.mockResolvedValue(true);

      await expect(campusService.delete(1)).resolves.toBeUndefined();
      expect(mockCampusRepo.delete).toHaveBeenCalledWith(1);
      expect(esClient.delete).toHaveBeenCalledWith({ index: 'campuses', id: '1' });
    });

    it('no debe fallar si Elasticsearch no responde al eliminar', async () => {
      esClient.delete.mockRejectedValueOnce(new Error('ES caído'));
      mockCampusRepo.findById.mockResolvedValue(existing);
      mockCampusRepo.delete.mockResolvedValue(true);

      await expect(campusService.delete(1)).resolves.toBeUndefined();
    });

    it('debe lanzar NotFoundError si no existe la sede a eliminar', async () => {
      mockCampusRepo.findById.mockResolvedValue(null);

      await expect(campusService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('search', () => {
    it('debe retornar lista vacía si el término está vacío', async () => {
      await expect(campusService.search(' ')).resolves.toEqual([]);
    });

    it('debe retornar resultados de Elasticsearch cuando existen', async () => {
      esClient.search.mockResolvedValueOnce({
        hits: { hits: [{ _source: { id: 1, name: 'Campus Robledo' } }] },
      });

      await expect(campusService.search('Robledo')).resolves.toEqual([
        { id: 1, name: 'Campus Robledo' },
      ]);
    });

    it('debe usar la base de datos si Elasticsearch falla', async () => {
      esClient.search.mockRejectedValueOnce(new Error('ES caído'));
      mockCampusRepo.search.mockResolvedValue([existing]);

      await expect(campusService.search({ search: 'Robledo' })).resolves.toEqual([existing]);
      expect(mockCampusRepo.search).toHaveBeenCalledWith('Robledo');
    });
  });
});
