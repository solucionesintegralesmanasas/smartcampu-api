const { esClient } = require('../../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../../src/core/exceptions');
const ProgramaService = require('../../../src/modules/programa/programa.service');

describe('Módulo Programa (Unit Tests)', () => {
  let mockProgramaRepo;
  let mockFacultadRepo;
  let mockRedisClient;
  let programaService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockProgramaRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCodigo: jest.fn(),
      findByNombre: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countStudentLinks: jest.fn(),
      withTransaction: jest.fn(async (cb) => cb({})),
    };

    mockFacultadRepo = {
      findById: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue(['programa:all']),
    };

    programaService = new ProgramaService(mockProgramaRepo, mockFacultadRepo, mockRedisClient);
  });

  describe('ProgramaService.create', () => {
    it('debe registrar programa e indexarlo con relación a facultad', async () => {
      const dto = {
        facultadId: 1,
        codigo: 'SIS-01',
        nombre: 'Ingeniería de Sistemas',
        nivel: 'undergraduate',
        duracionSemestres: 10,
        creditosTotales: 160,
      };

      mockFacultadRepo.findById.mockResolvedValue({ id: 1, nombre: 'Facultad de Ingeniería' });
      mockProgramaRepo.findByCodigo.mockResolvedValue(null);
      mockProgramaRepo.findByNombre.mockResolvedValue(null);

      const created = {
        id: 1,
        ...dto,
        activo: 1,
        Facultad: { id: 1, nombre: 'Facultad de Ingeniería' },
      };
      mockProgramaRepo.create.mockResolvedValue(created);
      const esIndexSpy = jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });

      const result = await programaService.create(dto);

      expect(result).toEqual(created);
      expect(esIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'uajs_university',
          id: 'programa_1',
          body: expect.objectContaining({
            type: 'programa',
            relaciones: [
              {
                type: 'facultad',
                id: 1,
                nombre: 'Facultad de Ingeniería',
              },
            ],
          }),
        }),
      );
    });

    it('debe lanzar NotFoundError si la facultad no existe', async () => {
      mockFacultadRepo.findById.mockResolvedValue(null);

      await expect(
        programaService.create({ facultadId: 99, codigo: 'X', nombre: 'Y' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('debe lanzar ConflictError si el código de programa está repetido', async () => {
      mockFacultadRepo.findById.mockResolvedValue({ id: 1 });
      mockProgramaRepo.findByCodigo.mockResolvedValue({ id: 2 });

      await expect(
        programaService.create({ facultadId: 1, codigo: 'SIS-01', nombre: 'Sistemas' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('ProgramaService.delete (Integridad referencial)', () => {
    it('debe impedir eliminación si hay estudiantes matriculados', async () => {
      mockProgramaRepo.findById.mockResolvedValue({ id: 1 });
      mockProgramaRepo.countStudentLinks.mockResolvedValue(10);

      await expect(programaService.delete(1)).rejects.toThrow(ConflictError);
    });

    it('debe eliminar programa si no tiene estudiantes vinculados', async () => {
      mockProgramaRepo.findById.mockResolvedValue({ id: 1 });
      mockProgramaRepo.countStudentLinks.mockResolvedValue(0);
      mockProgramaRepo.delete.mockResolvedValue(true);
      const esDeleteSpy = jest.spyOn(esClient.client, 'delete').mockResolvedValue({ body: {} });

      const res = await programaService.delete(1);
      expect(res.success).toBe(true);
      expect(esDeleteSpy).toHaveBeenCalledWith({
        index: 'uajs_university',
        id: 'programa_1',
      });
    });
  });
});
