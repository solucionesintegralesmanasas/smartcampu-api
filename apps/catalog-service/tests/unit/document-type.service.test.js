const { esClient } = require('../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const DocumentTypeService = require('../../src/modules/document-type/document-type.service');

describe('DocumentTypeService (Unit Tests)', () => {
  let mockDocumentTypeRepo;
  let mockRedisClient;
  let documentTypeService;

  const existing = {
    id: 1,
    uuid: 'uuid-cc',
    code: 'CC',
    name: 'Cédula de Ciudadanía',
    requiresCheckDigit: 0,
    appliesToNaturalPerson: 1,
    appliesToLegalEntity: 0,
    active: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDocumentTypeRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findByCode: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    documentTypeService = new DocumentTypeService(mockDocumentTypeRepo, mockRedisClient);
  });

  describe('create', () => {
    it('debe registrar un tipo de documento exitosamente', async () => {
      const dto = {
        name: 'Pasaporte',
        code: 'PAS',
        requiresCheckDigit: false,
        appliesToNaturalPerson: true,
        appliesToLegalEntity: false,
      };
      mockDocumentTypeRepo.findByName.mockResolvedValue(null);
      mockDocumentTypeRepo.findByCode.mockResolvedValue(null);
      mockDocumentTypeRepo.create.mockResolvedValue({ id: 5, ...dto, active: 1 });

      const result = await documentTypeService.create(dto);

      expect(mockDocumentTypeRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('id', 5);
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'document-types', id: '5' }),
      );
    });

    it('debe lanzar ConflictError si el nombre ya existe', async () => {
      mockDocumentTypeRepo.findByName.mockResolvedValue(existing);

      await expect(documentTypeService.create({ name: 'Cédula', code: 'CC' }))
        .rejects.toThrow(ConflictError);
      expect(mockDocumentTypeRepo.create).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si el código ya existe', async () => {
      mockDocumentTypeRepo.findByName.mockResolvedValue(null);
      mockDocumentTypeRepo.findByCode.mockResolvedValue({ id: 1, code: 'CC' });

      await expect(documentTypeService.create({ name: 'Cédula', code: 'CC' }))
        .rejects.toThrow(ConflictError);
      expect(mockDocumentTypeRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe retornar lista paginada', async () => {
      const paginated = {
        data: [existing],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      };
      mockDocumentTypeRepo.findAll.mockResolvedValue(paginated);

      await expect(documentTypeService.findAll({ page: 1, limit: 10 })).resolves.toEqual(paginated);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'documentTypes:all:1:10',
        JSON.stringify(paginated),
        3600,
      );
    });

    it('debe retornar desde la caché si existe', async () => {
      const cached = { data: [existing], pagination: { page: 1, limit: 10 } };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cached));

      await expect(documentTypeService.findAll({ page: 1, limit: 10 })).resolves.toEqual(cached);
      expect(mockDocumentTypeRepo.findAll).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('debe retornar el tipo de documento si existe', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(existing);

      await expect(documentTypeService.findById(1)).resolves.toEqual(existing);
    });

    it('debe retornar desde la caché si existe', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(existing));

      await expect(documentTypeService.findById(1)).resolves.toEqual(existing);
      expect(mockDocumentTypeRepo.findById).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si no existe', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(null);

      await expect(documentTypeService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('debe actualizar el tipo de documento exitosamente', async () => {
      const updateDto = { name: 'Cédula Digital' };
      mockDocumentTypeRepo.findById.mockResolvedValue(existing);
      mockDocumentTypeRepo.findByName.mockResolvedValue(null);
      mockDocumentTypeRepo.update.mockResolvedValue({ ...existing, ...updateDto });

      const result = await documentTypeService.update(1, updateDto);

      expect(result.name).toBe('Cédula Digital');
      expect(mockDocumentTypeRepo.update).toHaveBeenCalledWith(1, updateDto);
      expect(mockRedisClient.del).toHaveBeenCalledWith('documentTypes:1');
    });

    it('debe lanzar ConflictError si el nuevo nombre ya existe', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(existing);
      mockDocumentTypeRepo.findByName.mockResolvedValue({ id: 2, name: 'Otro' });

      await expect(documentTypeService.update(1, { name: 'Otro' })).rejects.toThrow(ConflictError);
      expect(mockDocumentTypeRepo.update).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si el nuevo código ya existe', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(existing);
      mockDocumentTypeRepo.findByCode.mockResolvedValue({ id: 3, code: 'TI' });

      await expect(documentTypeService.update(1, { code: 'TI' })).rejects.toThrow(ConflictError);
      expect(mockDocumentTypeRepo.update).not.toHaveBeenCalled();
    });

    it('no debe validar duplicados si nombre y código no cambian', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(existing);
      mockDocumentTypeRepo.update.mockResolvedValue(existing);

      await documentTypeService.update(1, { name: 'Cédula de Ciudadanía', code: 'CC' });

      expect(mockDocumentTypeRepo.findByName).not.toHaveBeenCalled();
      expect(mockDocumentTypeRepo.findByCode).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundError si no existe', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(null);

      await expect(documentTypeService.update(999, { name: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('debe eliminar tipo de documento si existe', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(existing);
      mockDocumentTypeRepo.delete.mockResolvedValue(true);

      await expect(documentTypeService.delete(1)).resolves.toBeUndefined();
      expect(mockDocumentTypeRepo.delete).toHaveBeenCalledWith(1);
    });

    it('no debe fallar si Elasticsearch no responde al eliminar', async () => {
      esClient.delete.mockRejectedValueOnce(new Error('ES caído'));
      mockDocumentTypeRepo.findById.mockResolvedValue(existing);
      mockDocumentTypeRepo.delete.mockResolvedValue(true);

      await expect(documentTypeService.delete(1)).resolves.toBeUndefined();
    });

    it('debe lanzar NotFoundError si no existe al intentar eliminar', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(null);

      await expect(documentTypeService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('search', () => {
    it('debe retornar lista vacía si el término está vacío', async () => {
      await expect(documentTypeService.search(undefined)).resolves.toEqual([]);
    });

    it('debe retornar resultados de Elasticsearch cuando existen', async () => {
      esClient.search.mockResolvedValueOnce({
        hits: { hits: [{ _source: { id: 1, code: 'CC' } }] },
      });

      await expect(documentTypeService.search('CC')).resolves.toEqual([{ id: 1, code: 'CC' }]);
    });

    it('debe usar la base de datos si Elasticsearch no tiene coincidencias', async () => {
      mockDocumentTypeRepo.search.mockResolvedValue([existing]);

      await expect(documentTypeService.search({ search: 'CC' })).resolves.toEqual([existing]);
      expect(mockDocumentTypeRepo.search).toHaveBeenCalledWith('CC');
    });
  });
});
