const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const DocumentTypeService = require('../../src/modules/document-type/document-type.service');

describe('DocumentTypeService (Unit Tests)', () => {
  let mockDocumentTypeRepo;
  let mockRedisClient;
  let documentTypeService;

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
      countAll: jest.fn(),
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
      };
      mockDocumentTypeRepo.findByName.mockResolvedValue(null);
      mockDocumentTypeRepo.findByCode.mockResolvedValue(null);
      mockDocumentTypeRepo.create.mockResolvedValue({ id: 5, ...dto, active: 1 });

      const result = await documentTypeService.create(dto);

      expect(mockDocumentTypeRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toHaveProperty('id', 5);
      expect(result.code).toBe('PAS');
    });

    it('debe lanzar ConflictError si el código ya existe', async () => {
      const dto = { name: 'Cédula', code: 'CC' };
      mockDocumentTypeRepo.findByName.mockResolvedValue(null);
      mockDocumentTypeRepo.findByCode.mockResolvedValue({ id: 1, code: 'CC' });

      await expect(documentTypeService.create(dto)).rejects.toThrow(ConflictError);
      expect(mockDocumentTypeRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe retornar lista paginada', async () => {
      const paginated = {
        data: [{
          id: 1, name: 'Cédula de Ciudadanía', code: 'CC', active: 1,
        }],
        pagination: {
          page: 1, limit: 10, total: 1, totalPages: 1,
        },
      };
      mockDocumentTypeRepo.findAll.mockResolvedValue(paginated);

      const result = await documentTypeService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(paginated);
    });
  });

  describe('findById', () => {
    it('debe retornar el tipo de documento si existe', async () => {
      const docType = { id: 1, code: 'CC', name: 'Cédula de Ciudadanía' };
      mockDocumentTypeRepo.findById.mockResolvedValue(docType);

      const result = await documentTypeService.findById(1);

      expect(result).toEqual(docType);
    });

    it('debe lanzar NotFoundError si no existe', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(null);

      await expect(documentTypeService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('debe actualizar el tipo de documento exitosamente', async () => {
      const existing = { id: 1, code: 'CC', name: 'Cédula de Ciudadanía' };
      const updateDto = { name: 'Cédula Digital' };
      mockDocumentTypeRepo.findById.mockResolvedValue(existing);
      mockDocumentTypeRepo.findByName.mockResolvedValue(null);
      mockDocumentTypeRepo.update.mockResolvedValue({ ...existing, ...updateDto });

      const result = await documentTypeService.update(1, updateDto);

      expect(result.name).toBe('Cédula Digital');
      expect(mockDocumentTypeRepo.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('delete', () => {
    it('debe eliminar tipo de documento si existe', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue({ id: 1, code: 'CC' });
      mockDocumentTypeRepo.delete.mockResolvedValue(true);

      await expect(documentTypeService.delete(1)).resolves.not.toThrow();
      expect(mockDocumentTypeRepo.delete).toHaveBeenCalledWith(1);
    });

    it('debe lanzar NotFoundError si no existe al intentar eliminar', async () => {
      mockDocumentTypeRepo.findById.mockResolvedValue(null);

      await expect(documentTypeService.delete(999)).rejects.toThrow(NotFoundError);
    });
  });
});
