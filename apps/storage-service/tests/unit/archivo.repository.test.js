jest.mock('@uajs/database-client', () => ({
  createMysqlPool: jest.fn(),
}));

jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    MYSQL_HOST: 'localhost',
    MYSQL_PORT: 3306,
    MYSQL_USER: 'test',
    MYSQL_PASSWORD: 'test',
    MYSQL_DATABASE: 'test_storage_db',
    STORAGE_INDEX: 'test_uajs_storage',
  },
}));

jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    search: jest.fn(),
    index: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    bulk: jest.fn(),
  },
}));

const { createMysqlPool } = require('@uajs/database-client');

const { esClient } = require('../../src/config/elasticsearch');
const { NotFoundError } = require('../../src/core/exceptions');
const ArchivoRepository = require('../../src/modules/archivo/archivo.repository');

const rowFixture = {
  id: 1,
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  nombre_original: 'documento.pdf',
  nombre_sistema: 'uuid.pdf',
  ruta_acceso: '/uploads/uuid.pdf',
  mime_type: 'application/pdf',
  peso_bytes: 100,
  entidad_asociada: 'evento',
  uuid_asociado: null,
  subido_por: 5,
  subido_por_nombre: 'Test',
  extension: '.pdf',
  carpeta: 'general',
  publico: 0,
  activo: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function mockPool(overrides = {}) {
  return {
    query: jest.fn().mockResolvedValue([]),
    beginTransaction: jest.fn(),
    ...overrides,
  };
}

function mockTx(queryImpl) {
  return {
    query: queryImpl || jest.fn().mockResolvedValue({ insertId: 1 }),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

describe('ArchivoRepository', () => {
  let repo;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ArchivoRepository();
    repo.pool = null;
  });

  describe('getPool', () => {
    it('crea el pool una sola vez (singleton)', async () => {
      const pool = mockPool();
      createMysqlPool.mockReturnValue(pool);

      const first = await repo.getPool();
      const second = await repo.getPool();

      expect(createMysqlPool).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });
  });

  describe('findById / findByUuid', () => {
    it('retorna la fila cuando existe', async () => {
      const pool = mockPool({ query: jest.fn().mockResolvedValue([rowFixture]) });
      repo.getPool = jest.fn().mockResolvedValue(pool);

      const result = await repo.findById(1);

      expect(result).toEqual(rowFixture);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?'), [1]);
    });

    it('retorna null cuando no existe', async () => {
      const pool = mockPool({ query: jest.fn().mockResolvedValue([]) });
      repo.getPool = jest.fn().mockResolvedValue(pool);

      expect(await repo.findById(999)).toBeNull();
    });

    it('busca por UUID', async () => {
      const pool = mockPool({ query: jest.fn().mockResolvedValue([rowFixture]) });
      repo.getPool = jest.fn().mockResolvedValue(pool);

      const result = await repo.findByUuid(rowFixture.uuid);

      expect(result.uuid).toBe(rowFixture.uuid);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE uuid = ?'), [
        rowFixture.uuid,
      ]);
    });
  });

  describe('findAll', () => {
    it('retorna archivos y total con paginación', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([{ total: 2 }])
        .mockResolvedValueOnce([rowFixture, rowFixture]);
      repo.getPool = jest.fn().mockResolvedValue(pool);

      const result = await repo.findAll({ page: 1, limit: 20 });

      expect(result.total).toBe(2);
      expect(result.files).toHaveLength(2);
    });

    it('aplica filtros de usuario, tipo, entidad y activo', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
      repo.getPool = jest.fn().mockResolvedValue(pool);

      await repo.findAll({
        page: 1,
        limit: 10,
        usuarioId: 5,
        tipo: 'application/pdf',
        entidad: 'evento',
        activo: true,
      });

      expect(pool.query.mock.calls[0][0]).toContain('subido_por = ?');
      expect(pool.query.mock.calls[0][0]).toContain('mime_type = ?');
      expect(pool.query.mock.calls[0][0]).toContain('entidad_asociada = ?');
      expect(pool.query.mock.calls[0][0]).toContain('activo = ?');
    });

    it('calcula offset para página 3', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
      repo.getPool = jest.fn().mockResolvedValue(pool);

      await repo.findAll({ page: 3, limit: 10 });

      const params = pool.query.mock.calls[1][1];
      expect(params).toContain(10);
      expect(params).toContain(20);
    });
  });

  describe('create', () => {
    it('inserta y retorna el archivo creado', async () => {
      const tx = mockTx();
      const pool = mockPool();
      pool.beginTransaction.mockResolvedValue(tx);
      repo.getPool = jest.fn().mockResolvedValue(pool);
      repo.findById = jest.fn().mockResolvedValue(rowFixture);

      const result = await repo.create({
        nombreOriginal: 'doc.pdf',
        nombreAlmacenado: 'uuid.pdf',
        ruta: '/uploads/uuid.pdf',
        tipo: 'application/pdf',
        tamano: 100,
        extension: '.pdf',
      });

      expect(tx.commit).toHaveBeenCalled();
      expect(result).toEqual(rowFixture);
    });

    it('hace rollback ante error de inserción', async () => {
      const tx = mockTx(jest.fn().mockRejectedValue(new Error('db fail')));
      const pool = mockPool();
      pool.beginTransaction.mockResolvedValue(tx);
      repo.getPool = jest.fn().mockResolvedValue(pool);

      await expect(repo.create({ nombreOriginal: 'x' })).rejects.toThrow('db fail');
      expect(tx.rollback).toHaveBeenCalled();
      expect(tx.release).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('actualiza campos y retorna el archivo', async () => {
      const tx = mockTx();
      const pool = mockPool();
      pool.beginTransaction.mockResolvedValue(tx);
      repo.getPool = jest.fn().mockResolvedValue(pool);
      repo.findById = jest.fn().mockResolvedValueOnce(rowFixture).mockResolvedValueOnce(rowFixture);

      const result = await repo.update(1, { carpeta: 'nueva', publico: true });

      expect(tx.query).toHaveBeenCalledWith(
        expect.stringContaining('carpeta = ?'),
        expect.arrayContaining(['nueva', 1]),
      );
      expect(result).toEqual(rowFixture);
    });

    it('lanza NotFoundError si no existe', async () => {
      const tx = mockTx();
      const pool = mockPool();
      pool.beginTransaction.mockResolvedValue(tx);
      repo.getPool = jest.fn().mockResolvedValue(pool);
      repo.findById = jest.fn().mockResolvedValue(null);

      await expect(repo.update(999, { carpeta: 'x' })).rejects.toThrow(NotFoundError);
      expect(tx.rollback).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('aplica soft delete', async () => {
      const tx = mockTx();
      const pool = mockPool();
      pool.beginTransaction.mockResolvedValue(tx);
      repo.getPool = jest.fn().mockResolvedValue(pool);
      repo.findById = jest.fn().mockResolvedValue(rowFixture);

      const result = await repo.delete(1);

      expect(tx.query).toHaveBeenCalledWith(expect.stringContaining('deleted_at'), [1]);
      expect(result).toEqual({ success: true });
    });

    it('lanza NotFoundError si no existe', async () => {
      const tx = mockTx();
      const pool = mockPool();
      pool.beginTransaction.mockResolvedValue(tx);
      repo.getPool = jest.fn().mockResolvedValue(pool);
      repo.findById = jest.fn().mockResolvedValue(null);

      await expect(repo.delete(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('searchInElasticsearch', () => {
    it('busca con multi_match y retorna total + archivos', async () => {
      esClient.search.mockResolvedValue({
        hits: {
          total: { value: 2 },
          hits: [{ _source: rowFixture }, { _source: rowFixture }],
        },
      });

      const result = await repo.searchInElasticsearch({
        search: 'contrato',
        usuarioId: 5,
        tipo: 'application/pdf',
        entidad: 'evento',
        activo: true,
        offset: 0,
        limit: 20,
      });

      expect(esClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ index: 'test_uajs_storage' }),
      );
      expect(result.total).toBe(2);
      expect(result.files).toHaveLength(2);
    });

    it('soporta total numérico (compatibilidad ES)', async () => {
      esClient.search.mockResolvedValue({
        hits: { total: 5, hits: [] },
      });

      const result = await repo.searchInElasticsearch({ search: 'x' });
      expect(result.total).toBe(5);
    });

    it('construye filtros solo con valores presentes', async () => {
      esClient.search.mockResolvedValue({ hits: { total: { value: 0 }, hits: [] } });

      await repo.searchInElasticsearch({ search: 'q', offset: 0, limit: 5 });

      const params = esClient.search.mock.calls[0][0];
      const matchQuery = params.query.bool.must[0].bool
        ? params.query.bool.must[0].bool.should[0].multi_match.query
        : params.query.bool.must[0].multi_match.query;
      expect(matchQuery).toBe('q');
      expect(params.query.bool.filter).toHaveLength(0);
    });
  });
});
