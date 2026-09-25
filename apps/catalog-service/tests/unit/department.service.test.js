const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const DepartmentService = require('../../src/modules/department/department.service');

describe('DepartmentService (Unit Tests)', () => {
  let mockDepartmentRepo;
  let mockRedisClient;
  let departmentService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDepartmentRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
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

    departmentService = new DepartmentService(mockDepartmentRepo, mockRedisClient);
  });

  describe('create', () => {
    it('debe registrar un departamento exitosamente', async () => {
      const dto = { countryId: 1, name: 'Santander', daneCode: '68' };
      mockDepartmentRepo.findByName.mockResolvedValue(null);
      mockDepartmentRepo.create.mockResolvedValue({ id: 26, ...dto, active: 1 });

      const result = await departmentService.create(dto);

      expect(mockDepartmentRepo.findByName).toHaveBeenCalledWith('Santander');
      expect(mockDepartmentRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('id', 26);
      expect(result.name).toBe('Santander');
    });

    it('debe lanzar ConflictError si el nombre del departamento ya existe', async () => {
      const dto = { countryId: 1, name: 'Antioquia', daneCode: '05' };
      mockDepartmentRepo.findByName.mockResolvedValue({ id: 1, name: 'Antioquia' });

      await expect(departmentService.create(dto)).rejects.toThrow(ConflictError);
      expect(mockDepartmentRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe retornar lista paginada desde repositorio cuando no está en caché', async () => {
      const paginatedResult = {
        data: [{
          id: 1, name: 'Antioquia', daneCode: '05', active: 1,
        }],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      };
      mockDepartmentRepo.findAll.mockResolvedValue(paginatedResult);

      const result = await departmentService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(paginatedResult);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('debe retornar datos desde la caché si existen', async () => {
      const cached = {
        data: [{ id: 1, name: 'Antioquia' }],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await departmentService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(cached);
      expect(mockDepartmentRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('debe retornar el departamento si existe', async () => {
      const dept = {
        id: 1, name: 'Antioquia', daneCode: '05', active: 1,
      };
      mockDepartmentRepo.findById.mockResolvedValue(dept);

      const result = await departmentService.findById(1);

      expect(result).toEqual(dept);
      expect(mockDepartmentRepo.findById).toHaveBeenCalledWith(1);
    });

    it('debe lanzar NotFoundError si el departamento no existe', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(null);

      await expect(departmentService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('debe actualizar los datos del departamento exitosamente', async () => {
      const existing = {
        id: 1, name: 'Antioquia', daneCode: '05', active: 1,
      };
      const updateDto = { name: 'Antioquia Grande' };
      mockDepartmentRepo.findById.mockResolvedValue(existing);
      mockDepartmentRepo.findByName.mockResolvedValue(null);
      mockDepartmentRepo.update.mockResolvedValue({ ...existing, ...updateDto });

      const result = await departmentService.update(1, updateDto);

      expect(result.name).toBe('Antioquia Grande');
      expect(mockDepartmentRepo.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('debe lanzar ConflictError si el nuevo nombre ya está ocupado', async () => {
      const existing = { id: 1, name: 'Antioquia', daneCode: '05' };
      const updateDto = { name: 'Cundinamarca' };
      mockDepartmentRepo.findById.mockResolvedValue(existing);
      mockDepartmentRepo.findByName.mockResolvedValue({ id: 13, name: 'Cundinamarca' });

      await expect(departmentService.update(1, updateDto)).rejects.toThrow(ConflictError);
      expect(mockDepartmentRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('debe eliminar departamento si existe', async () => {
      mockDepartmentRepo.findById.mockResolvedValue({ id: 1, name: 'Antioquia' });
      mockDepartmentRepo.delete.mockResolvedValue(true);

      await expect(departmentService.delete(1)).resolves.not.toThrow();
      expect(mockDepartmentRepo.delete).toHaveBeenCalledWith(1);
    });

    it('debe lanzar NotFoundError si no existe al intentar eliminar', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(null);

      await expect(departmentService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });
});
