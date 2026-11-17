const { esClient } = require('../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const CityService = require('../../src/modules/city/city.service');

describe('CityService (Unit Tests)', () => {
  let mockCityRepo;
  let mockRedisClient;
  let cityService;

  const existing = {
    id: 1,
    uuid: 'uuid-med',
    name: 'Medellín',
    daneCode: '05001',
    stateId: 1,
    active: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCityRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByStateId: jest.fn(),
      findByNameAndState: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    cityService = new CityService(mockCityRepo, mockRedisClient);
  });

  describe('create', () => {
    it('debe registrar una ciudad exitosamente', async () => {
      const dto = { stateId: 1, name: 'Envigado', daneCode: '05266' };
      mockCityRepo.findByNameAndState.mockResolvedValue(null);
      mockCityRepo.create.mockResolvedValue({ id: 7, ...dto, active: 1 });

      const result = await cityService.create(dto);

      expect(mockCityRepo.findByNameAndState).toHaveBeenCalledWith('Envigado', 1);
      expect(mockCityRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('id', 7);
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'cities', id: '7' }),
      );
    });

    it('debe lanzar ConflictError si la ciudad ya existe en el mismo departamento', async () => {
      const dto = { stateId: 1, name: 'Medellín', daneCode: '05001' };
      mockCityRepo.findByNameAndState.mockResolvedValue(existing);

      await expect(cityService.create(dto)).rejects.toThrow(ConflictError);
      expect(mockCityRepo.create).not.toHaveBeenCalled();
    });

    it('no debe fallar si Elasticsearch no responde al indexar', async () => {
      esClient.index.mockRejectedValueOnce(new Error('ES caído'));
      mockCityRepo.findByNameAndState.mockResolvedValue(null);
      mockCityRepo.create.mockResolvedValue({ ...existing, id: 9 });

      await expect(cityService.create({ stateId: 1, name: 'Bello' }))
        .resolves.toHaveProperty('id', 9);
    });
  });

  describe('findAll', () => {
    it('debe retornar lista paginada desde repositorio cuando no está en caché', async () => {
      const paginatedResult = {
        data: [existing],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      };
      mockCityRepo.findAll.mockResolvedValue(paginatedResult);

      const result = await cityService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(paginatedResult);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('debe retornar datos desde la caché si existen', async () => {
      const cached = { data: [existing], pagination: { page: 1, limit: 10 } };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      await expect(cityService.findAll({ page: 1, limit: 10 })).resolves.toEqual(cached);
      expect(mockCityRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findByStateId', () => {
    it('debe retornar ciudades pertenecientes a un departamento', async () => {
      const cities = [existing];
      mockCityRepo.findByStateId.mockResolvedValue(cities);

      const result = await cityService.findByStateId(1);

      expect(result).toEqual(cities);
      expect(mockCityRepo.findByStateId).toHaveBeenCalledWith(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'cities:state:1',
        JSON.stringify(cities),
        3600,
      );
    });

    it('debe retornar desde la caché si existe', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify([existing]));

      await expect(cityService.findByStateId(1)).resolves.toEqual([existing]);
      expect(mockCityRepo.findByStateId).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('debe retornar la ciudad si existe', async () => {
      mockCityRepo.findById.mockResolvedValue(existing);

      await expect(cityService.findById(1)).resolves.toEqual(existing);
    });

    it('debe retornar la ciudad desde la caché si existe', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existing));

      await expect(cityService.findById(1)).resolves.toEqual(existing);
      expect(mockCityRepo.findById).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si la ciudad no existe', async () => {
      mockCityRepo.findById.mockResolvedValue(null);

      await expect(cityService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('debe actualizar la ciudad exitosamente', async () => {
      const updateDto = { name: 'Medellín Capital' };
      mockCityRepo.findById.mockResolvedValue(existing);
      mockCityRepo.findByNameAndState.mockResolvedValue(null);
      mockCityRepo.update.mockResolvedValue({ ...existing, ...updateDto });

      const result = await cityService.update(1, updateDto);

      expect(mockCityRepo.findByNameAndState).toHaveBeenCalledWith('Medellín Capital', 1);
      expect(result.name).toBe('Medellín Capital');
      expect(mockCityRepo.update).toHaveBeenCalledWith(1, updateDto);
      expect(mockRedisClient.del).toHaveBeenCalledWith('cities:1');
    });

    it('no debe validar duplicados si nombre y departamento no cambian', async () => {
      mockCityRepo.findById.mockResolvedValue(existing);
      mockCityRepo.update.mockResolvedValue(existing);

      await cityService.update(1, { daneCode: '05002' });

      expect(mockCityRepo.findByNameAndState).not.toHaveBeenCalled();
    });

    it('debe validar duplicados si cambia el departamento', async () => {
      mockCityRepo.findById.mockResolvedValue(existing);
      mockCityRepo.findByNameAndState.mockResolvedValue({ id: 50 });

      await expect(cityService.update(1, { stateId: 2 })).rejects.toThrow(ConflictError);
      expect(mockCityRepo.update).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si la ciudad no existe', async () => {
      mockCityRepo.findById.mockResolvedValue(null);

      await expect(cityService.update(999, { name: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('debe eliminar la ciudad si existe', async () => {
      mockCityRepo.findById.mockResolvedValue(existing);
      mockCityRepo.delete.mockResolvedValue(true);

      await expect(cityService.delete(1)).resolves.toBeUndefined();
      expect(mockCityRepo.delete).toHaveBeenCalledWith(1);
      expect(esClient.delete).toHaveBeenCalledWith({ index: 'cities', id: '1' });
    });

    it('no debe fallar si Elasticsearch no responde al eliminar', async () => {
      esClient.delete.mockRejectedValueOnce(new Error('ES caído'));
      mockCityRepo.findById.mockResolvedValue(existing);
      mockCityRepo.delete.mockResolvedValue(true);

      await expect(cityService.delete(1)).resolves.toBeUndefined();
    });

    it('debe lanzar NotFoundError si no existe al intentar eliminar', async () => {
      mockCityRepo.findById.mockResolvedValue(null);

      await expect(cityService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('search', () => {
    it('debe retornar lista vacía si el término está vacío', async () => {
      await expect(cityService.search('')).resolves.toEqual([]);
    });

    it('debe retornar resultados de Elasticsearch cuando existen', async () => {
      esClient.search.mockResolvedValueOnce({
        hits: { hits: [{ _source: { id: 1, name: 'Medellín' } }] },
      });

      await expect(cityService.search('Medel')).resolves.toEqual([{ id: 1, name: 'Medellín' }]);
    });

    it('debe usar la base de datos si Elasticsearch no responde', async () => {
      esClient.search.mockRejectedValueOnce(new Error('ES caído'));
      mockCityRepo.search.mockResolvedValue([existing]);

      await expect(cityService.search({ search: 'Medellín' })).resolves.toEqual([existing]);
      expect(mockCityRepo.search).toHaveBeenCalledWith('Medellín');
    });
  });
});
