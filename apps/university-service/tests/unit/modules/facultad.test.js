const { esClient } = require('../../../src/config/elasticsearch');
const { ConflictError } = require('../../../src/core/exceptions');
const FacultadService = require('../../../src/modules/facultad/facultad.service');

describe('Módulo Facultad (Unit Tests)', () => {
  let mockFacultadRepo;
  let mockRedisClient;
  let facultadService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFacultadRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCodigo: jest.fn(),
      findByNombre: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countProgramLinks: jest.fn(),
      countTeacherLinks: jest.fn(),
      withTransaction: jest.fn(async (cb) => cb({})),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue(['facultad:all']),
    };

    facultadService = new FacultadService(mockFacultadRepo, mockRedisClient);
  });

  describe('FacultadService.create', () => {
    it('debe registrar facultad e indexarla en Elasticsearch', async () => {
      const dto = {
        campusId: 1,
        codigo: 'FING',
        nombre: 'Facultad de Ingeniería',
        email: 'ingenieria@uajs.edu.co',
      };

      mockFacultadRepo.findByCodigo.mockResolvedValue(null);
      mockFacultadRepo.findByNombre.mockResolvedValue(null);
      const createdFacultad = { id: 1, ...dto, activo: 1 };
      mockFacultadRepo.create.mockResolvedValue(createdFacultad);
      const esIndexSpy = jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });

      const result = await facultadService.create(dto);

      expect(result).toEqual(createdFacultad);
      expect(esIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'uajs_university',
          id: 'facultad_1',
          body: expect.objectContaining({
            type: 'facultad',
            nombre: dto.nombre,
            codigo: dto.codigo,
          }),
        }),
      );
    });

    it('debe lanzar ConflictError si el código ya existe', async () => {
      mockFacultadRepo.findByCodigo.mockResolvedValue({ id: 2 });
      await expect(
        facultadService.create({ codigo: 'FING', nombre: 'Ingeniería' }),
      ).rejects.toThrow(ConflictError);
    });

    it('debe lanzar ConflictError si el nombre ya existe', async () => {
      mockFacultadRepo.findByCodigo.mockResolvedValue(null);
      mockFacultadRepo.findByNombre.mockResolvedValue({ id: 3 });
      await expect(
        facultadService.create({ codigo: 'FING2', nombre: 'Ingeniería' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('FacultadService.delete (Integridad referencial)', () => {
    it('debe impedir eliminar si tiene programas académicos asociados', async () => {
      mockFacultadRepo.findById.mockResolvedValue({ id: 1 });
      mockFacultadRepo.countProgramLinks.mockResolvedValue(2);

      await expect(facultadService.delete(1)).rejects.toThrow(ConflictError);
    });

    it('debe impedir eliminar si tiene docentes vinculados', async () => {
      mockFacultadRepo.findById.mockResolvedValue({ id: 1 });
      mockFacultadRepo.countProgramLinks.mockResolvedValue(0);
      mockFacultadRepo.countTeacherLinks.mockResolvedValue(5);

      await expect(facultadService.delete(1)).rejects.toThrow(ConflictError);
    });

    it('debe eliminar la facultad si no tiene dependencias', async () => {
      mockFacultadRepo.findById.mockResolvedValue({ id: 1 });
      mockFacultadRepo.countProgramLinks.mockResolvedValue(0);
      mockFacultadRepo.countTeacherLinks.mockResolvedValue(0);
      mockFacultadRepo.delete.mockResolvedValue(true);
      const esDeleteSpy = jest.spyOn(esClient.client, 'delete').mockResolvedValue({ body: {} });

      const res = await facultadService.delete(1);
      expect(res.success).toBe(true);
      expect(esDeleteSpy).toHaveBeenCalledWith({
        index: 'uajs_university',
        id: 'facultad_1',
      });
    });
  });

  describe('FacultadService.search', () => {
    it('debe buscar facultades en Elasticsearch', async () => {
      jest.spyOn(esClient.client, 'search').mockResolvedValue({
        body: {
          hits: {
            hits: [{ _source: { id: 1, type: 'facultad', nombre: 'Facultad de Ingeniería' } }],
          },
        },
      });

      const res = await facultadService.search('Ingeniería');
      expect(res).toHaveLength(1);
      expect(res[0].nombre).toBe('Facultad de Ingeniería');
    });
  });
});
