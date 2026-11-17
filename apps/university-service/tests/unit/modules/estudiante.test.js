const { esClient } = require('../../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../../src/core/exceptions');
const EstudianteService = require('../../../src/modules/estudiante/estudiante.service');

describe('Módulo Estudiante (Unit Tests)', () => {
  let mockEstudianteRepo;
  let mockTerceroRepo;
  let mockProgramaRepo;
  let mockRedisClient;
  let estudianteService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEstudianteRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCodigo: jest.fn(),
      findByPersonaId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      withTransaction: jest.fn(async (cb) => cb({})),
    };

    mockTerceroRepo = {
      findById: jest.fn(),
    };

    mockProgramaRepo = {
      findById: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue(['estudiante:all']),
    };

    estudianteService = new EstudianteService(
      mockEstudianteRepo,
      mockTerceroRepo,
      mockProgramaRepo,
      mockRedisClient,
    );
  });

  describe('EstudianteService.create', () => {
    it('debe matricular un estudiante e indexarlo en Elasticsearch con relaciones a tercero y programa', async () => {
      const dto = {
        personaId: 10,
        programaId: 2,
        codigoEstudiante: '20261001',
        fechaMatricula: '2026-02-01',
      };

      mockTerceroRepo.findById.mockResolvedValue({
        id: 10,
        primerNombre: 'Ana',
        primerApellido: 'Martínez',
        numeroDocumento: '10203040',
      });
      mockProgramaRepo.findById.mockResolvedValue({ id: 2, nombre: 'Medicina' });
      mockEstudianteRepo.findByCodigo.mockResolvedValue(null);
      mockEstudianteRepo.findByPersonaId.mockResolvedValue(null);

      const createdEstudiante = {
        id: 100,
        ...dto,
        estado: 'active',
        Tercero: { id: 10, nombre: 'Ana Martínez', numeroDocumento: '10203040' },
        Programa: { id: 2, nombre: 'Medicina' },
      };
      mockEstudianteRepo.create.mockResolvedValue(createdEstudiante);
      const esIndexSpy = jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });

      const result = await estudianteService.create(dto);

      expect(result).toEqual(createdEstudiante);
      expect(esIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'uajs_university',
          id: 'estudiante_100',
          body: expect.objectContaining({
            type: 'estudiante',
            id: 100,
            codigo: '20261001',
            nombre: 'Ana Martínez',
            relaciones: expect.arrayContaining([
              expect.objectContaining({ type: 'tercero', id: 10 }),
              expect.objectContaining({ type: 'programa', id: 2 }),
            ]),
          }),
        }),
      );
    });

    it('debe lanzar NotFoundError si la persona (tercero) no existe', async () => {
      mockTerceroRepo.findById.mockResolvedValue(null);

      await expect(
        estudianteService.create({ personaId: 99, programaId: 1, codigoEstudiante: '123' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('debe lanzar NotFoundError si el programa académico no existe', async () => {
      mockTerceroRepo.findById.mockResolvedValue({ id: 1 });
      mockProgramaRepo.findById.mockResolvedValue(null);

      await expect(
        estudianteService.create({ personaId: 1, programaId: 99, codigoEstudiante: '123' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('debe lanzar ConflictError si el código de estudiante ya existe', async () => {
      mockTerceroRepo.findById.mockResolvedValue({ id: 1 });
      mockProgramaRepo.findById.mockResolvedValue({ id: 2 });
      mockEstudianteRepo.findByCodigo.mockResolvedValue({ id: 5 });

      await expect(
        estudianteService.create({ personaId: 1, programaId: 2, codigoEstudiante: 'DUPLICADO' }),
      ).rejects.toThrow(ConflictError);
    });

    it('debe lanzar ConflictError si la persona ya está matriculada como estudiante', async () => {
      mockTerceroRepo.findById.mockResolvedValue({ id: 1 });
      mockProgramaRepo.findById.mockResolvedValue({ id: 2 });
      mockEstudianteRepo.findByCodigo.mockResolvedValue(null);
      mockEstudianteRepo.findByPersonaId.mockResolvedValue({ id: 9 });

      await expect(
        estudianteService.create({ personaId: 1, programaId: 2, codigoEstudiante: 'OK123' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('EstudianteService.delete', () => {
    it('debe eliminar estudiante y remover de Elasticsearch', async () => {
      mockEstudianteRepo.findById.mockResolvedValue({ id: 100 });
      mockEstudianteRepo.delete.mockResolvedValue(true);
      const esDeleteSpy = jest.spyOn(esClient.client, 'delete').mockResolvedValue({ body: {} });

      const res = await estudianteService.delete(100);
      expect(res.success).toBe(true);
      expect(esDeleteSpy).toHaveBeenCalledWith({
        index: 'uajs_university',
        id: 'estudiante_100',
      });
    });
  });
});
