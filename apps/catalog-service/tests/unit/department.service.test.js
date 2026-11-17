const { esClient } = require('../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const DepartmentService = require('../../src/modules/department/department.service');

describe('DepartmentService (Unit Tests)', () => {
  let mockDepartmentRepo;
  let mockRedisClient;
  let departmentService;

  const existing = {
    id: 1,
    uuid: 'uuid-ant',
    countryId: 1,
    name: 'Antioquia',
    daneCode: '05',
    active: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDepartmentRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByNameAndCountry: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
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
      mockDepartmentRepo.findByNameAndCountry.mockResolvedValue(null);
      mockDepartmentRepo.create.mockResolvedValue({ id: 26, ...dto, active: 1 });

      const result = await departmentService.create(dto);

      expect(mockDepartmentRepo.findByNameAndCountry).toHaveBeenCalledWith('Santander', 1);
      expect(mockDepartmentRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('id', 26);
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'departments', id: '26' }),
      );
    });

    it('debe lanzar ConflictError si el nombre ya existe en el mismo país', async () => {
      const dto = { countryId: 1, name: 'Antioquia', daneCode: '05' };
      mockDepartmentRepo.findByNameAndCountry.mockResolvedValue(existing);

      await expect(departmentService.create(dto)).rejects.toThrow(ConflictError);
      expect(mockDepartmentRepo.create).not.toHaveBeenCalled();
    });

    it('no debe fallar si Elasticsearch no responde al indexar', async () => {
      esClient.index.mockRejectedValueOnce(new Error('ES caído'));
      mockDepartmentRepo.findByNameAndCountry.mockResolvedValue(null);
      mockDepartmentRepo.create.mockResolvedValue({ ...existing, id: 30 });

      await expect(departmentService.create({ countryId: 1, name: 'Chocó' }))
        .resolves.toHaveProperty('id', 30);
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
      mockDepartmentRepo.findAll.mockResolvedValue(paginatedResult);

      const result = await departmentService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(paginatedResult);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'departments:all:1:10',
        JSON.stringify(paginatedResult),
        3600,
      );
    });

    it('debe retornar datos desde la caché si existen', async () => {
      const cached = { data: [existing], pagination: { page: 1, limit: 10 } };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await departmentService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(cached);
      expect(mockDepartmentRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('debe retornar el departamento si existe', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(existing);

      const result = await departmentService.findById(1);

      expect(result).toEqual(existing);
      expect(mockDepartmentRepo.findById).toHaveBeenCalledWith(1);
    });

    it('debe retornar el departamento desde la caché si existe', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existing));

      const result = await departmentService.findById(1);

      expect(result).toEqual(existing);
      expect(mockDepartmentRepo.findById).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si el departamento no existe', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(null);

      await expect(departmentService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('debe actualizar los datos del departamento exitosamente', async () => {
      const updateDto = { name: 'Antioquia Grande' };
      mockDepartmentRepo.findById.mockResolvedValue(existing);
      mockDepartmentRepo.findByNameAndCountry.mockResolvedValue(null);
      mockDepartmentRepo.update.mockResolvedValue({ ...existing, ...updateDto });

      const result = await departmentService.update(1, updateDto);

      expect(mockDepartmentRepo.findByNameAndCountry).toHaveBeenCalledWith('Antioquia Grande', 1);
      expect(result.name).toBe('Antioquia Grande');
      expect(mockDepartmentRepo.update).toHaveBeenCalledWith(1, updateDto);
      expect(mockRedisClient.del).toHaveBeenCalledWith('departments:1');
    });

    it('no debe validar duplicados si nombre y país no cambian', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(existing);
      mockDepartmentRepo.update.mockResolvedValue(existing);

      await departmentService.update(1, { daneCode: '06' });

      expect(mockDepartmentRepo.findByNameAndCountry).not.toHaveBeenCalled();
    });

    it('debe validar duplicados si cambia el país', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(existing);
      mockDepartmentRepo.findByNameAndCountry.mockResolvedValue({ id: 99 });

      await expect(departmentService.update(1, { countryId: 2 })).rejects.toThrow(ConflictError);
      expect(mockDepartmentRepo.update).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si el nuevo nombre ya está ocupado', async () => {
      const updateDto = { name: 'Cundinamarca' };
      mockDepartmentRepo.findById.mockResolvedValue(existing);
      mockDepartmentRepo.findByNameAndCountry.mockResolvedValue({ id: 13, name: 'Cundinamarca' });

      await expect(departmentService.update(1, updateDto)).rejects.toThrow(ConflictError);
      expect(mockDepartmentRepo.update).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si el departamento no existe', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(null);

      await expect(departmentService.update(999, { name: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('debe eliminar departamento si existe', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(existing);
      mockDepartmentRepo.delete.mockResolvedValue(true);

      await expect(departmentService.delete(1)).resolves.toBeUndefined();
      expect(mockDepartmentRepo.delete).toHaveBeenCalledWith(1);
      expect(esClient.delete).toHaveBeenCalledWith({ index: 'departments', id: '1' });
    });

    it('no debe fallar si Elasticsearch no responde al eliminar', async () => {
      esClient.delete.mockRejectedValueOnce(new Error('ES caído'));
      mockDepartmentRepo.findById.mockResolvedValue(existing);
      mockDepartmentRepo.delete.mockResolvedValue(true);

      await expect(departmentService.delete(1)).resolves.toBeUndefined();
    });

    it('debe lanzar NotFoundError si no existe al intentar eliminar', async () => {
      mockDepartmentRepo.findById.mockResolvedValue(null);

      await expect(departmentService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('search', () => {
    it('debe retornar lista vacía si el término está vacío', async () => {
      await expect(departmentService.search('  ')).resolves.toEqual([]);
    });

    it('debe retornar resultados de Elasticsearch cuando existen', async () => {
      esClient.search.mockResolvedValueOnce({
        hits: { hits: [{ _source: { id: 1, name: 'Antioquia' } }] },
      });

      const result = await departmentService.search('Antio');

      expect(result).toEqual([{ id: 1, name: 'Antioquia' }]);
    });

    it('debe usar la base de datos si Elasticsearch no devuelve coincidencias', async () => {
      mockDepartmentRepo.search.mockResolvedValue([existing]);

      const result = await departmentService.search({ search: 'Antioquia' });

      expect(result).toEqual([existing]);
      expect(mockDepartmentRepo.search).toHaveBeenCalledWith('Antioquia');
    });

    it('debe usar la base de datos si Elasticsearch falla', async () => {
      esClient.search.mockRejectedValueOnce(new Error('ES caído'));
      mockDepartmentRepo.search.mockResolvedValue([existing]);

      await expect(departmentService.search('Antioquia')).resolves.toEqual([existing]);
    });
  });
});
