const { esClient } = require('../../../src/config/elasticsearch');
const { ConflictError, NotFoundError } = require('../../../src/core/exceptions');
const DocenteService = require('../../../src/modules/docente/docente.service');
const EstudianteService = require('../../../src/modules/estudiante/estudiante.service');
const FacultadService = require('../../../src/modules/facultad/facultad.service');
const ProgramaService = require('../../../src/modules/programa/programa.service');
const TerceroService = require('../../../src/modules/tercero/tercero.service');

describe('Pruebas Unitarias de Servicios (Cobertura Integral)', () => {
  let mockRepo;
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepo = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue({ data: [{ id: 1 }], pagination: { total: 1 } }),
      findById: jest.fn(),
      findByCodigo: jest.fn(),
      findByNombre: jest.fn(),
      findByDocumento: jest.fn(),
      findByPersonaId: jest.fn(),
      findByNit: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(true),
      countStudentLinks: jest.fn().mockResolvedValue(0),
      countTeacherLinks: jest.fn().mockResolvedValue(0),
      countProgramLinks: jest.fn().mockResolvedValue(0),
      countAssociatedTerceros: jest.fn().mockResolvedValue(0),
      withTransaction: jest.fn(async (cb) => cb({})),
    };

    mockRedisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue(['test:key:1']),
    };

    jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });
    jest.spyOn(esClient.client, 'delete').mockResolvedValue({ body: {} });
    jest.spyOn(esClient.client, 'search').mockResolvedValue({
      body: { hits: { hits: [{ _source: { id: 1, nombre: 'Test' } }] } },
    });
  });

  describe('TerceroService Métodos Completos', () => {
    let service;
    beforeEach(() => {
      service = new TerceroService(mockRepo, mockRepo, mockRedisClient);
    });

    it('findAll con caché y sin búsqueda', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));
      const cached = await service.findAll();
      expect(cached).toEqual({ cached: true });

      mockRedisClient.get.mockResolvedValueOnce(null);
      const res = await service.findAll({ page: 2, limit: 10 });
      expect(res.data).toBeDefined();
    });

    it('findById con y sin caché', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: 1, cached: true }));
      expect(await service.findById(1)).toEqual({ id: 1, cached: true });

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRepo.findById.mockResolvedValueOnce({ id: 1 });
      expect(await service.findById(1)).toEqual({ id: 1 });

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundError);
    });

    it('update éxito y validaciones', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        id: 1,
        tipoDocumento: 'CC',
        numeroDocumento: '123',
      });
      mockRepo.update.mockResolvedValueOnce({ id: 1, primerNombre: 'Actualizado' });

      const updated = await service.update(1, { primerNombre: 'Actualizado' });
      expect(updated.primerNombre).toBe('Actualizado');

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundError);

      mockRepo.findById.mockResolvedValueOnce({
        id: 1,
        tipoDocumento: 'CC',
        numeroDocumento: '123',
      });
      mockRepo.findByDocumento.mockResolvedValueOnce({ id: 2 });
      await expect(service.update(1, { numeroDocumento: '456' })).rejects.toThrow(ConflictError);

      mockRepo.findById.mockResolvedValueOnce({
        id: 1,
        tipoDocumento: 'CC',
        numeroDocumento: '123',
      });
      mockRepo.findById.mockResolvedValueOnce(null); // empresa no existe
      await expect(service.update(1, { empresaId: 99 })).rejects.toThrow(NotFoundError);
    });

    it('delete cuando no existe lanza NotFoundError', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('FacultadService Métodos Completos', () => {
    let service;
    beforeEach(() => {
      service = new FacultadService(mockRepo, mockRedisClient);
    });

    it('findAll con caché y sin caché', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));
      expect(await service.findAll()).toEqual({ cached: true });

      mockRedisClient.get.mockResolvedValueOnce(null);
      expect((await service.findAll()).data).toBeDefined();
    });

    it('findById con y sin caché', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: 1 }));
      expect(await service.findById(1)).toEqual({ id: 1 });

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRepo.findById.mockResolvedValueOnce({ id: 1 });
      expect(await service.findById(1)).toEqual({ id: 1 });

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundError);
    });

    it('update éxito y validaciones', async () => {
      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigo: 'F1', nombre: 'N1' });
      mockRepo.update.mockResolvedValueOnce({ id: 1, nombre: 'N2' });
      expect(await service.update(1, { nombre: 'N2' })).toEqual({ id: 1, nombre: 'N2' });

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundError);

      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigo: 'F1', nombre: 'N1' });
      mockRepo.findByCodigo.mockResolvedValueOnce({ id: 2 });
      await expect(service.update(1, { codigo: 'F2' })).rejects.toThrow(ConflictError);

      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigo: 'F1', nombre: 'N1' });
      mockRepo.findByNombre.mockResolvedValueOnce({ id: 2 });
      await expect(service.update(1, { nombre: 'N_DUP' })).rejects.toThrow(ConflictError);
    });

    it('delete cuando no existe lanza NotFoundError', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('ProgramaService Métodos Completos', () => {
    let service;
    beforeEach(() => {
      service = new ProgramaService(mockRepo, mockRepo, mockRedisClient);
    });

    it('findAll con caché y sin caché', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));
      expect(await service.findAll()).toEqual({ cached: true });

      mockRedisClient.get.mockResolvedValueOnce(null);
      expect((await service.findAll()).data).toBeDefined();
    });

    it('findById con y sin caché', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: 1 }));
      expect(await service.findById(1)).toEqual({ id: 1 });

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRepo.findById.mockResolvedValueOnce({ id: 1 });
      expect(await service.findById(1)).toEqual({ id: 1 });

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundError);
    });

    it('update éxito y validaciones', async () => {
      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigo: 'P1', nombre: 'N1' });
      mockRepo.update.mockResolvedValueOnce({ id: 1, nombre: 'N2' });
      expect(await service.update(1, { nombre: 'N2' })).toEqual({ id: 1, nombre: 'N2' });

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundError);

      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigo: 'P1' });
      mockRepo.findById.mockResolvedValueOnce(null); // facultad no existe
      await expect(service.update(1, { facultadId: 99 })).rejects.toThrow(NotFoundError);

      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigo: 'P1' });
      mockRepo.findByCodigo.mockResolvedValueOnce({ id: 2 });
      await expect(service.update(1, { codigo: 'P2' })).rejects.toThrow(ConflictError);

      mockRepo.findById.mockResolvedValueOnce({ id: 1, nombre: 'N1' });
      mockRepo.findByNombre.mockResolvedValueOnce({ id: 2 });
      await expect(service.update(1, { nombre: 'N2' })).rejects.toThrow(ConflictError);
    });

    it('delete cuando no existe lanza NotFoundError', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundError);
    });

    it('search en programa', async () => {
      const res = await service.search('Sistemas');
      expect(res).toHaveLength(1);
    });
  });

  describe('EstudianteService Métodos Completos', () => {
    let service;
    beforeEach(() => {
      service = new EstudianteService(mockRepo, mockRepo, mockRepo, mockRedisClient);
    });

    it('findAll con y sin caché', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));
      expect(await service.findAll()).toEqual({ cached: true });

      mockRedisClient.get.mockResolvedValueOnce(null);
      expect((await service.findAll()).data).toBeDefined();
    });

    it('findById con y sin caché', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: 1 }));
      expect(await service.findById(1)).toEqual({ id: 1 });

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRepo.findById.mockResolvedValueOnce({ id: 1 });
      expect(await service.findById(1)).toEqual({ id: 1 });

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundError);
    });

    it('update éxito y validaciones', async () => {
      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigoEstudiante: 'E1' });
      mockRepo.update.mockResolvedValueOnce({ id: 1, semestreActual: 2 });
      expect(await service.update(1, { semestreActual: 2 })).toEqual({ id: 1, semestreActual: 2 });

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundError);

      mockRepo.findById.mockResolvedValueOnce({ id: 1 });
      mockRepo.findById.mockResolvedValueOnce(null); // programa no existe
      await expect(service.update(1, { programaId: 99 })).rejects.toThrow(NotFoundError);

      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigoEstudiante: 'E1' });
      mockRepo.findByCodigo.mockResolvedValueOnce({ id: 2 });
      await expect(service.update(1, { codigoEstudiante: 'E2' })).rejects.toThrow(ConflictError);
    });

    it('delete cuando no existe lanza NotFoundError', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundError);
    });

    it('search en estudiante', async () => {
      const res = await service.search('Estudiante');
      expect(res).toHaveLength(1);
    });
  });

  describe('DocenteService Métodos Completos', () => {
    let service;
    beforeEach(() => {
      service = new DocenteService(mockRepo, mockRepo, mockRepo, mockRedisClient);
    });

    it('findAll con y sin caché', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));
      expect(await service.findAll()).toEqual({ cached: true });

      mockRedisClient.get.mockResolvedValueOnce(null);
      expect((await service.findAll()).data).toBeDefined();
    });

    it('findById con y sin caché', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: 1 }));
      expect(await service.findById(1)).toEqual({ id: 1 });

      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRepo.findById.mockResolvedValueOnce({ id: 1 });
      expect(await service.findById(1)).toEqual({ id: 1 });

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundError);
    });

    it('update éxito y validaciones', async () => {
      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigoDocente: 'D1' });
      mockRepo.update.mockResolvedValueOnce({ id: 1, estado: 'retired' });
      expect(await service.update(1, { estado: 'retired' })).toEqual({ id: 1, estado: 'retired' });

      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.update(999, {})).rejects.toThrow(NotFoundError);

      mockRepo.findById.mockResolvedValueOnce({ id: 1 });
      mockRepo.findById.mockResolvedValueOnce(null); // facultad no existe
      await expect(service.update(1, { facultadId: 99 })).rejects.toThrow(NotFoundError);

      mockRepo.findById.mockResolvedValueOnce({ id: 1, codigoDocente: 'D1' });
      mockRepo.findByCodigo.mockResolvedValueOnce({ id: 2 });
      await expect(service.update(1, { codigoDocente: 'D2' })).rejects.toThrow(ConflictError);
    });

    it('delete cuando no existe lanza NotFoundError', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.delete(999)).rejects.toThrow(NotFoundError);
    });

    it('search en docente', async () => {
      const res = await service.search('Docente');
      expect(res).toHaveLength(1);
    });
  });
});
