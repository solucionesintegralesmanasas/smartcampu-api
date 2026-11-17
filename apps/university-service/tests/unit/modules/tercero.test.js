const { esClient } = require('../../../src/config/elasticsearch');
const { ConflictError } = require('../../../src/core/exceptions');
const TerceroController = require('../../../src/modules/tercero/tercero.controller');
const TerceroService = require('../../../src/modules/tercero/tercero.service');

describe('Módulo Tercero (Unit Tests)', () => {
  let mockTerceroRepo;
  let mockEmpresaRepo;
  let mockRedisClient;
  let terceroService;
  let terceroController;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTerceroRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByDocumento: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countStudentLinks: jest.fn(),
      countTeacherLinks: jest.fn(),
      withTransaction: jest.fn(async (cb) => cb({})),
    };

    mockEmpresaRepo = {
      findById: jest.fn(),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue(['tercero:all']),
    };

    terceroService = new TerceroService(mockTerceroRepo, mockEmpresaRepo, mockRedisClient);
    terceroController = new TerceroController(terceroService);
  });

  describe('TerceroService.create e indexación con relaciones en ES', () => {
    it('debe crear un tercero e indexarlo en Elasticsearch', async () => {
      const dto = {
        tipoDocumento: 'CC',
        numeroDocumento: '1098765432',
        primerNombre: 'Carlos',
        primerApellido: 'Rodríguez',
        email: 'carlos@empresa.com',
      };

      mockTerceroRepo.findByDocumento.mockResolvedValue(null);

      const createdTercero = {
        id: 10,
        ...dto,
        activo: 1,
        Empresa: null,
        empresa: null,
      };
      mockTerceroRepo.create.mockResolvedValue(createdTercero);
      const esIndexSpy = jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });

      const result = await terceroService.create(dto);

      expect(result).toEqual(createdTercero);
      expect(esIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'uajs_university',
          id: 'tercero_10',
          body: expect.objectContaining({
            type: 'tercero',
            id: 10,
            relaciones: [],
          }),
        }),
      );
    });

    it('debe lanzar ConflictError si ya existe una persona con el mismo documento', async () => {
      mockTerceroRepo.findByDocumento.mockResolvedValue({ id: 1 });

      await expect(
        terceroService.create({ tipoDocumento: 'CC', numeroDocumento: '1098765432' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('TerceroService.delete (Integridad referencial)', () => {
    it('debe impedir eliminación si tiene matrícula de estudiante activa', async () => {
      mockTerceroRepo.findById.mockResolvedValue({ id: 10 });
      mockTerceroRepo.countStudentLinks.mockResolvedValue(1);

      await expect(terceroService.delete(10)).rejects.toThrow(ConflictError);
    });

    it('debe impedir eliminación si tiene registro docente activo', async () => {
      mockTerceroRepo.findById.mockResolvedValue({ id: 10 });
      mockTerceroRepo.countStudentLinks.mockResolvedValue(0);
      mockTerceroRepo.countTeacherLinks.mockResolvedValue(1);

      await expect(terceroService.delete(10)).rejects.toThrow(ConflictError);
    });

    it('debe eliminar y remover de Elasticsearch si no tiene dependencias', async () => {
      mockTerceroRepo.findById.mockResolvedValue({ id: 10 });
      mockTerceroRepo.countStudentLinks.mockResolvedValue(0);
      mockTerceroRepo.countTeacherLinks.mockResolvedValue(0);
      mockTerceroRepo.delete.mockResolvedValue(true);
      const esDeleteSpy = jest.spyOn(esClient.client, 'delete').mockResolvedValue({ body: {} });

      const res = await terceroService.delete(10);
      expect(res.success).toBe(true);
      expect(esDeleteSpy).toHaveBeenCalledWith({
        index: 'uajs_university',
        id: 'tercero_10',
      });
    });
  });

  describe('TerceroService.search', () => {
    it('debe consultar Elasticsearch con term type y multi_match', async () => {
      const esSearchSpy = jest.spyOn(esClient.client, 'search').mockResolvedValue({
        body: {
          hits: {
            hits: [{ _source: { id: 10, nombre: 'Carlos Rodríguez', type: 'tercero' } }],
          },
        },
      });

      const results = await terceroService.search({ search: 'Carlos' });

      expect(results).toHaveLength(1);
      expect(esSearchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'uajs_university',
          body: expect.objectContaining({
            query: {
              bool: {
                must: expect.arrayContaining([{ term: { type: 'tercero' } }]),
              },
            },
          }),
        }),
      );
    });
  });

  describe('TerceroController', () => {
    it('debe manejar findAll respondiendo status 200', async () => {
      const req = { query: { page: '1', limit: '10' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      jest.spyOn(terceroService, 'findAll').mockResolvedValue({
        data: [{ id: 1 }],
        pagination: { total: 1 },
      });

      await terceroController.findAll(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
