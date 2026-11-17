const { esClient } = require('../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const CountryService = require('../../src/modules/country/country.service');

describe('CountryService (Unit Tests)', () => {
  let mockCountryRepo;
  let mockRedisClient;
  let countryService;

  const existing = {
    id: 1,
    uuid: 'uuid-co',
    isoCode: 'CO',
    isoCode3: 'COL',
    name: 'Colombia',
    phoneCode: '+57',
    active: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCountryRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findByIsoCode: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countActiveDepartments: jest.fn(),
      search: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    countryService = new CountryService(mockCountryRepo, mockRedisClient);
  });

  describe('create', () => {
    it('debe registrar un país exitosamente e indexarlo en Elasticsearch', async () => {
      const dto = {
        isoCode: 'MX', isoCode3: 'MEX', name: 'México', phoneCode: '+52',
      };
      mockCountryRepo.findByName.mockResolvedValue(null);
      mockCountryRepo.findByIsoCode.mockResolvedValue(null);
      mockCountryRepo.create.mockResolvedValue({ id: 2, ...dto, active: 1 });

      const result = await countryService.create(dto);

      expect(mockCountryRepo.create).toHaveBeenCalledWith(dto);
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'countries', id: '2' }),
      );
      expect(result.id).toBe(2);
    });

    it('debe lanzar ConflictError si el nombre ya existe', async () => {
      mockCountryRepo.findByName.mockResolvedValue(existing);

      await expect(countryService.create({ isoCode: 'CO', name: 'Colombia' }))
        .rejects.toThrow(ConflictError);
      expect(mockCountryRepo.create).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si el código ISO ya existe', async () => {
      mockCountryRepo.findByName.mockResolvedValue(null);
      mockCountryRepo.findByIsoCode.mockResolvedValue(existing);

      await expect(countryService.create({ isoCode: 'CO', name: 'Otro' }))
        .rejects.toThrow(ConflictError);
      expect(mockCountryRepo.create).not.toHaveBeenCalled();
    });

    it('no debe fallar si Elasticsearch no responde al indexar', async () => {
      esClient.index.mockRejectedValueOnce(new Error('ES caído'));
      mockCountryRepo.findByName.mockResolvedValue(null);
      mockCountryRepo.findByIsoCode.mockResolvedValue(null);
      mockCountryRepo.create.mockResolvedValue({ ...existing, id: 3 });

      await expect(countryService.create({ isoCode: 'CO', name: 'Colombia' }))
        .resolves.toHaveProperty('id', 3);
    });
  });

  describe('findAll', () => {
    it('debe consultar el repositorio y guardar en caché si no hay datos cacheados', async () => {
      const paginated = {
        data: [existing],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      };
      mockCountryRepo.findAll.mockResolvedValue(paginated);

      const result = await countryService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(paginated);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'countries:all:1:10',
        JSON.stringify(paginated),
        3600,
      );
    });

    it('debe devolver la caché sin consultar el repositorio', async () => {
      const cached = { data: [existing], pagination: { page: 1, limit: 10 } };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      const result = await countryService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(cached);
      expect(mockCountryRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('debe retornar el país si existe', async () => {
      mockCountryRepo.findById.mockResolvedValue(existing);

      const result = await countryService.findById(1);

      expect(result).toEqual(existing);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'countries:1',
        JSON.stringify(existing),
        3600,
      );
    });

    it('debe devolver la caché si existe', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existing));

      const result = await countryService.findById(1);

      expect(result).toEqual(existing);
      expect(mockCountryRepo.findById).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si el país no existe', async () => {
      mockCountryRepo.findById.mockResolvedValue(null);

      await expect(countryService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('debe actualizar el país y reindexarlo', async () => {
      const updateDto = { name: 'Colombia Continental' };
      mockCountryRepo.findById.mockResolvedValue(existing);
      mockCountryRepo.findByName.mockResolvedValue(null);
      mockCountryRepo.update.mockResolvedValue({ ...existing, ...updateDto });

      const result = await countryService.update(1, updateDto);

      expect(result.name).toBe('Colombia Continental');
      expect(mockCountryRepo.update).toHaveBeenCalledWith(1, updateDto);
      expect(esClient.index).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('countries:1');
    });

    it('no debe validar duplicados si el nombre y el código no cambian', async () => {
      mockCountryRepo.findById.mockResolvedValue(existing);
      mockCountryRepo.update.mockResolvedValue(existing);

      await countryService.update(1, { name: 'Colombia', isoCode: 'CO' });

      expect(mockCountryRepo.findByName).not.toHaveBeenCalled();
      expect(mockCountryRepo.findByIsoCode).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si el nuevo nombre ya está ocupado', async () => {
      mockCountryRepo.findById.mockResolvedValue(existing);
      mockCountryRepo.findByName.mockResolvedValue({ id: 5, name: 'Perú' });

      await expect(countryService.update(1, { name: 'Perú' })).rejects.toThrow(ConflictError);
      expect(mockCountryRepo.update).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si el nuevo código ISO ya está ocupado', async () => {
      mockCountryRepo.findById.mockResolvedValue(existing);
      mockCountryRepo.findByIsoCode.mockResolvedValue({ id: 5, isoCode: 'PE' });

      await expect(countryService.update(1, { isoCode: 'PE' })).rejects.toThrow(ConflictError);
      expect(mockCountryRepo.update).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si el país no existe', async () => {
      mockCountryRepo.findById.mockResolvedValue(null);

      await expect(countryService.update(999, { name: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('debe hacer borrado lógico si no tiene departamentos activos', async () => {
      mockCountryRepo.findById.mockResolvedValue(existing);
      mockCountryRepo.countActiveDepartments.mockResolvedValue(0);
      mockCountryRepo.delete.mockResolvedValue(true);

      await countryService.delete(1);

      expect(mockCountryRepo.delete).toHaveBeenCalledWith(1);
      expect(esClient.delete).toHaveBeenCalledWith({ index: 'countries', id: '1' });
      expect(mockRedisClient.del).toHaveBeenCalledWith('countries:1');
    });

    it('debe bloquear la eliminación si tiene departamentos asociados', async () => {
      mockCountryRepo.findById.mockResolvedValue(existing);
      mockCountryRepo.countActiveDepartments.mockResolvedValue(3);

      await expect(countryService.delete(1)).rejects.toThrow(ConflictError);
      expect(mockCountryRepo.delete).not.toHaveBeenCalled();
    });

    it('no debe fallar si Elasticsearch no responde al eliminar', async () => {
      esClient.delete.mockRejectedValueOnce(new Error('ES caído'));
      mockCountryRepo.findById.mockResolvedValue(existing);
      mockCountryRepo.countActiveDepartments.mockResolvedValue(0);
      mockCountryRepo.delete.mockResolvedValue(true);

      await expect(countryService.delete(1)).resolves.toBeUndefined();
    });

    it('debe lanzar NotFoundError si el país no existe', async () => {
      mockCountryRepo.findById.mockResolvedValue(null);

      await expect(countryService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('search', () => {
    it('debe retornar lista vacía si el término está vacío', async () => {
      await expect(countryService.search('   ')).resolves.toEqual([]);
      await expect(countryService.search({})).resolves.toEqual([]);
    });

    it('debe retornar los resultados de Elasticsearch cuando existen', async () => {
      esClient.search.mockResolvedValueOnce({
        hits: { hits: [{ _source: { id: 1, name: 'Colombia' } }] },
      });

      const result = await countryService.search({ search: 'Colom' });

      expect(result).toEqual([{ id: 1, name: 'Colombia' }]);
      expect(mockCountryRepo.search).not.toHaveBeenCalled();
    });

    it('debe usar la base de datos si Elasticsearch no tiene resultados', async () => {
      mockCountryRepo.search.mockResolvedValue([existing]);

      const result = await countryService.search('Colombia');

      expect(result).toEqual([existing]);
      expect(mockCountryRepo.search).toHaveBeenCalledWith('Colombia');
    });

    it('debe usar la base de datos si Elasticsearch falla', async () => {
      esClient.search.mockRejectedValueOnce(new Error('ES caído'));
      mockCountryRepo.search.mockResolvedValue([existing]);

      const result = await countryService.search('Colombia');

      expect(result).toEqual([existing]);
    });
  });
});
