const { esClient } = require('../../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../../src/core/exceptions');
const DocenteService = require('../../../src/modules/docente/docente.service');

describe('Módulo Docente (Unit Tests)', () => {
  let mockDocenteRepo;
  let mockTerceroRepo;
  let mockFacultadRepo;
  let mockRedisClient;
  let docenteService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDocenteRepo = {
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

    mockFacultadRepo = {
      findById: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue(['docente:all']),
    };

    docenteService = new DocenteService(
      mockDocenteRepo,
      mockTerceroRepo,
      mockFacultadRepo,
      mockRedisClient,
    );
  });

  describe('DocenteService.create', () => {
    it('debe registrar un docente e indexarlo con relaciones a persona y facultad', async () => {
      const dto = {
        personaId: 20,
        facultadId: 1,
        codigoDocente: 'DOC-101',
        tipoContrato: 'full_time',
        fechaContratacion: '2025-01-15',
        tituloAcademico: 'Doctor en Computación',
      };

      mockTerceroRepo.findById.mockResolvedValue({
        id: 20,
        primerNombre: 'Pedro',
        primerApellido: 'López',
        numeroDocumento: '8090100',
      });
      mockFacultadRepo.findById.mockResolvedValue({ id: 1, nombre: 'Facultad de Ingeniería' });
      mockDocenteRepo.findByCodigo.mockResolvedValue(null);
      mockDocenteRepo.findByPersonaId.mockResolvedValue(null);

      const createdDocente = {
        id: 50,
        ...dto,
        estado: 'active',
        Tercero: { id: 20, nombre: 'Pedro López', numeroDocumento: '8090100' },
        Facultad: { id: 1, nombre: 'Facultad de Ingeniería' },
      };
      mockDocenteRepo.create.mockResolvedValue(createdDocente);
      const esIndexSpy = jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });

      const result = await docenteService.create(dto);

      expect(result).toEqual(createdDocente);
      expect(esIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'uajs_university',
          id: 'docente_50',
          body: expect.objectContaining({
            type: 'docente',
            id: 50,
            codigo: 'DOC-101',
            nombre: 'Pedro López',
            relaciones: expect.arrayContaining([
              expect.objectContaining({ type: 'tercero', id: 20 }),
              expect.objectContaining({ type: 'facultad', id: 1 }),
            ]),
          }),
        }),
      );
    });

    it('debe lanzar NotFoundError si la persona no existe', async () => {
      mockTerceroRepo.findById.mockResolvedValue(null);

      await expect(
        docenteService.create({ personaId: 99, facultadId: 1, codigoDocente: 'DOC-01' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('debe lanzar NotFoundError si la facultad no existe', async () => {
      mockTerceroRepo.findById.mockResolvedValue({ id: 1 });
      mockFacultadRepo.findById.mockResolvedValue(null);

      await expect(
        docenteService.create({ personaId: 1, facultadId: 99, codigoDocente: 'DOC-01' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('debe lanzar ConflictError si el código docente ya existe', async () => {
      mockTerceroRepo.findById.mockResolvedValue({ id: 1 });
      mockFacultadRepo.findById.mockResolvedValue({ id: 1 });
      mockDocenteRepo.findByCodigo.mockResolvedValue({ id: 8 });

      await expect(
        docenteService.create({ personaId: 1, facultadId: 1, codigoDocente: 'DOC-REPETIDO' }),
      ).rejects.toThrow(ConflictError);
    });

    it('debe lanzar ConflictError si la persona ya está registrada como docente', async () => {
      mockTerceroRepo.findById.mockResolvedValue({ id: 1 });
      mockFacultadRepo.findById.mockResolvedValue({ id: 1 });
      mockDocenteRepo.findByCodigo.mockResolvedValue(null);
      mockDocenteRepo.findByPersonaId.mockResolvedValue({ id: 9 });

      await expect(
        docenteService.create({ personaId: 1, facultadId: 1, codigoDocente: 'DOC-NEW' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('DocenteService.delete', () => {
    it('debe eliminar docente y remover de Elasticsearch', async () => {
      mockDocenteRepo.findById.mockResolvedValue({ id: 50 });
      mockDocenteRepo.delete.mockResolvedValue(true);
      const esDeleteSpy = jest.spyOn(esClient.client, 'delete').mockResolvedValue({ body: {} });

      const res = await docenteService.delete(50);
      expect(res.success).toBe(true);
      expect(esDeleteSpy).toHaveBeenCalledWith({
        index: 'uajs_university',
        id: 'docente_50',
      });
    });
  });
});
