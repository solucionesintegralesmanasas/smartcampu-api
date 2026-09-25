const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const CampusService = require('../../src/modules/campus/campus.service');

describe('CampusService (Unit Tests)', () => {
  let mockCampusRepo;
  let mockRedisClient;
  let campusService;

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
      countAll: jest.fn(),
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
      const dto = {
        cityId: 1,
        name: 'Campus Robledo',
        address: 'Carrera 80 # 65-223',
        phone: '+57 604 4309000',
      };
      mockCampusRepo.findByName.mockResolvedValue(null);
      mockCampusRepo.create.mockResolvedValue({ id: 1, ...dto, active: 1 });

      const result = await campusService.create(dto);

      expect(mockCampusRepo.findByName).toHaveBeenCalledWith('Campus Robledo');
      expect(mockCampusRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('id', 1);
      expect(result.name).toBe('Campus Robledo');
    });

    it('debe lanzar ConflictError si el nombre del campus ya existe', async () => {
      const dto = { cityId: 1, name: 'Campus Robledo' };
      mockCampusRepo.findByName.mockResolvedValue({ id: 1, name: 'Campus Robledo' });

      await expect(campusService.create(dto)).rejects.toThrow(ConflictError);
      expect(mockCampusRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe listar campuses de forma paginada', async () => {
      const paginated = {
        data: [{ id: 1, name: 'Campus Robledo', active: 1 }],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      };
      mockCampusRepo.findAll.mockResolvedValue(paginated);

      const result = await campusService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(paginated);
    });
  });

  describe('findByCityId', () => {
    it('debe retornar las sedes de una ciudad específica', async () => {
      const campuses = [{ id: 1, name: 'Campus Robledo', cityId: 1 }];
      mockCampusRepo.findByCityId.mockResolvedValue(campuses);

      const result = await campusService.findByCityId(1);

      expect(result).toEqual(campuses);
      expect(mockCampusRepo.findByCityId).toHaveBeenCalledWith(1);
    });
  });

  describe('findById', () => {
    it('debe retornar el campus si existe', async () => {
      const campus = { id: 1, name: 'Campus Robledo', cityId: 1 };
      mockCampusRepo.findById.mockResolvedValue(campus);

      const result = await campusService.findById(1);

      expect(result).toEqual(campus);
    });

    it('debe lanzar NotFoundError si el campus no existe', async () => {
      mockCampusRepo.findById.mockResolvedValue(null);

      await expect(campusService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('debe actualizar el campus exitosamente', async () => {
      const existing = { id: 1, name: 'Campus Robledo' };
      const updateDto = { address: 'Nueva dirección # 12-34' };
      mockCampusRepo.findById.mockResolvedValue(existing);
      mockCampusRepo.update.mockResolvedValue({ ...existing, ...updateDto });

      const result = await campusService.update(1, updateDto);

      expect(result.address).toBe('Nueva dirección # 12-34');
      expect(mockCampusRepo.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('delete', () => {
    it('debe eliminar la sede si existe', async () => {
      mockCampusRepo.findById.mockResolvedValue({ id: 1, name: 'Campus Robledo' });
      mockCampusRepo.delete.mockResolvedValue(true);

      await expect(campusService.delete(1)).resolves.not.toThrow();
      expect(mockCampusRepo.delete).toHaveBeenCalledWith(1);
    });

    it('debe lanzar NotFoundError si no existe la sede a eliminar', async () => {
      mockCampusRepo.findById.mockResolvedValue(null);

      await expect(campusService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });
});
