const { esClient } = require('../../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../../src/core/exceptions');
const EmpresaController = require('../../../src/modules/empresa/empresa.controller');
const EmpresaService = require('../../../src/modules/empresa/empresa.service');

describe('Módulo Empresa (Unit Tests)', () => {
  let mockEmpresaRepo;
  let mockRedisClient;
  let empresaService;
  let empresaController;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEmpresaRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByNit: jest.fn(),
      findByName: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countAssociatedTerceros: jest.fn(),
      withTransaction: jest.fn(async (cb) => cb({})),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue(['empresa:all:1:20:']),
    };

    empresaService = new EmpresaService(mockEmpresaRepo, mockRedisClient);
    empresaController = new EmpresaController(empresaService);
  });

  describe('EmpresaService.create', () => {
    it('debe crear una empresa e indexarla en Elasticsearch', async () => {
      const dto = {
        razonSocial: 'Tech Solutions S.A.S.',
        nit: '900123456',
        direccion: 'Calle 100 # 15-20',
        email: 'info@techsolutions.com',
      };

      const createdMock = { id: 1, ...dto, activo: 1 };
      mockEmpresaRepo.findByNit.mockResolvedValue(null);
      mockEmpresaRepo.create.mockResolvedValue(createdMock);
      const esIndexSpy = jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });

      const result = await empresaService.create(dto);

      expect(mockEmpresaRepo.findByNit).toHaveBeenCalledWith(dto.nit);
      expect(result).toEqual(createdMock);
      expect(esIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'uajs_university',
          id: 'empresa_1',
          body: expect.objectContaining({
            type: 'empresa',
            id: 1,
            nombre: dto.razonSocial,
            codigo: dto.nit,
          }),
        }),
      );
      expect(mockRedisClient.keys).toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si el NIT ya existe', async () => {
      mockEmpresaRepo.findByNit.mockResolvedValue({ id: 2, nit: '900123456' });

      await expect(
        empresaService.create({ razonSocial: 'Otra', nit: '900123456' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('EmpresaService.findAll y findById', () => {
    it('debe retornar lista paginada desde el repositorio si no hay caché', async () => {
      const mockResult = { data: [{ id: 1, razonSocial: 'Empresa 1' }], pagination: { total: 1 } };
      mockEmpresaRepo.findAll.mockResolvedValue(mockResult);

      const result = await empresaService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(mockResult);
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('debe retornar datos desde caché de Redis si existe', async () => {
      const cachedData = { data: [{ id: 1, razonSocial: 'Caché Empresa' }] };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await empresaService.findAll({ page: 1, limit: 10 });

      expect(result).toEqual(cachedData);
      expect(mockEmpresaRepo.findAll).not.toHaveBeenCalled();
    });

    it('debe retornar empresa por ID o lanzar NotFoundError si no existe', async () => {
      mockEmpresaRepo.findById.mockResolvedValueOnce({ id: 1, razonSocial: 'Empresa 1' });
      const found = await empresaService.findById(1);
      expect(found.id).toBe(1);

      mockEmpresaRepo.findById.mockResolvedValueOnce(null);
      await expect(empresaService.findById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('EmpresaService.update', () => {
    it('debe actualizar la empresa y reindexar en Elasticsearch', async () => {
      mockEmpresaRepo.findById.mockResolvedValue({
        id: 1,
        nit: '900123456',
        razonSocial: 'Antigua',
      });
      mockEmpresaRepo.update.mockResolvedValue({ id: 1, nit: '900123456', razonSocial: 'Nueva' });
      const esIndexSpy = jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });

      const updated = await empresaService.update(1, { razonSocial: 'Nueva' });

      expect(updated.razonSocial).toBe('Nueva');
      expect(esIndexSpy).toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si cambia el NIT a uno ya existente', async () => {
      mockEmpresaRepo.findById.mockResolvedValue({ id: 1, nit: '900123456' });
      mockEmpresaRepo.findByNit.mockResolvedValue({ id: 2, nit: '900999999' });

      await expect(empresaService.update(1, { nit: '900999999' })).rejects.toThrow(ConflictError);
    });
  });

  describe('EmpresaService.delete (Integridad Referencial)', () => {
    it('debe impedir eliminación si tiene terceros vinculados', async () => {
      mockEmpresaRepo.findById.mockResolvedValue({ id: 1, razonSocial: 'Empresa Activa' });
      mockEmpresaRepo.countAssociatedTerceros.mockResolvedValue(3);

      await expect(empresaService.delete(1)).rejects.toThrow(ConflictError);
      expect(mockEmpresaRepo.delete).not.toHaveBeenCalled();
    });

    it('debe eliminar la empresa y remover de Elasticsearch si no tiene dependencias', async () => {
      mockEmpresaRepo.findById.mockResolvedValue({ id: 1, razonSocial: 'Empresa Libre' });
      mockEmpresaRepo.countAssociatedTerceros.mockResolvedValue(0);
      mockEmpresaRepo.delete.mockResolvedValue(true);
      const esDeleteSpy = jest.spyOn(esClient.client, 'delete').mockResolvedValue({ body: {} });

      const response = await empresaService.delete(1);

      expect(response.success).toBe(true);
      expect(esDeleteSpy).toHaveBeenCalledWith({
        index: 'uajs_university',
        id: 'empresa_1',
      });
    });
  });

  describe('EmpresaService.search', () => {
    it('debe consultar Elasticsearch y mapear _source', async () => {
      jest.spyOn(esClient.client, 'search').mockResolvedValue({
        body: {
          hits: {
            hits: [{ _source: { id: 1, nombre: 'Tech Solutions', type: 'empresa' } }],
          },
        },
      });

      const results = await empresaService.search({ search: 'Tech' });
      expect(results).toHaveLength(1);
      expect(results[0].nombre).toBe('Tech Solutions');
    });
  });

  describe('EmpresaController', () => {
    it('debe invocar a create y responder con status 201', async () => {
      const req = { body: { razonSocial: 'Prueba', nit: '12345' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      jest.spyOn(empresaService, 'create').mockResolvedValue({ id: 1, ...req.body });

      await empresaController.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
