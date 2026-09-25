const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const CityService = require('../../src/modules/city/city.service');

describe('CityService (Unit Tests)', () => {
  let mockCityRepo;
  let mockRedisClient;
  let cityService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCityRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByStateId: jest.fn(),
      findByName: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countAll: jest.fn(),
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
      mockCityRepo.findByName.mockResolvedValue(null);
      mockCityRepo.create.mockResolvedValue({ id: 7, ...dto, active: 1 });

      const result = await cityService.create(dto);

      expect(mockCityRepo.findByName).toHaveBeenCalledWith('Envigado');
      expect(mockCityRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('id', 7);
      expect(result.name).toBe('Envigado');
    });

    it('debe lanzar ConflictError si el nombre de la ciudad ya existe', async () => {
      const dto = { stateId: 1, name: 'Medellín', daneCode: '05001' };
      mockCityRepo.findByName.mockResolvedValue({ id: 1, name: 'Medellín' });

      await expect(cityService.create(dto)).rejects.toThrow(ConflictError);
      expect(mockCityRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe retornar lista paginada desde repositorio cuando no está en caché', async () => {
      const paginatedResult = {
        data: [{
          id: 1, name: 'Medellín', stateId: 1, active: 1,
        }],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      };
      mockCityRepo.findAll.mockResolvedValue(paginatedResult);

      const result = await cityService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(paginatedResult);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });
  });

  describe('findByStateId', () => {
    it('debe retornar ciudades pertenecientes a un departamento', async () => {
      const cities = [{ id: 1, name: 'Medellín', stateId: 1 }];
      mockCityRepo.findByStateId.mockResolvedValue(cities);

      const result = await cityService.findByStateId(1);

      expect(result).toEqual(cities);
      expect(mockCityRepo.findByStateId).toHaveBeenCalledWith(1);
    });
  });

  describe('findById', () => {
    it('debe retornar la ciudad si existe', async () => {
      const city = {
        id: 1, name: 'Medellín', stateId: 1, active: 1,
      };
      mockCityRepo.findById.mockResolvedValue(city);

      const result = await cityService.findById(1);

      expect(result).toEqual(city);
    });

    it('debe lanzar NotFoundError si la ciudad no existe', async () => {
      mockCityRepo.findById.mockResolvedValue(null);

      await expect(cityService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('debe actualizar la ciudad exitosamente', async () => {
      const existing = { id: 1, name: 'Medellín', stateId: 1 };
      const updateDto = { name: 'Medellín Capital' };
      mockCityRepo.findById.mockResolvedValue(existing);
      mockCityRepo.findByName.mockResolvedValue(null);
      mockCityRepo.update.mockResolvedValue({ ...existing, ...updateDto });

      const result = await cityService.update(1, updateDto);

      expect(result.name).toBe('Medellín Capital');
      expect(mockCityRepo.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('delete', () => {
    it('debe eliminar la ciudad si existe', async () => {
      mockCityRepo.findById.mockResolvedValue({ id: 1, name: 'Medellín' });
      mockCityRepo.delete.mockResolvedValue(true);

      await expect(cityService.delete(1)).resolves.not.toThrow();
      expect(mockCityRepo.delete).toHaveBeenCalledWith(1);
    });

    it('debe lanzar NotFoundError si no existe al intentar eliminar', async () => {
      mockCityRepo.findById.mockResolvedValue(null);

      await expect(cityService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });
});
