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
  },
}));

const { createMysqlPool } = require('@uajs/database-client');
const { esClient } = require('../../src/config/elasticsearch');
const ArchivoRepository = require('../../src/modules/archivo/archivo.repository');

const UUID = '550e8400-e29b-41d4-a716-446655440000';

const rowFixture = {
  id: 1,
  uuid: UUID,
  nombre_original: 'documento.pdf',
  nombre_sistema: 'interno.pdf',
  ruta_acceso: '/uploads/interno.pdf',
  mime_type: 'application/pdf',
  peso_bytes: 100,
  extension: '.pdf',
  entidad_asociada: 'request',
  uuid_asociado: null,
  subido_por: 5,
  subido_por_nombre: 'Test',
  carpeta: 'general',
  publico: 0,
  activo: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SCOPE_PRIVADO = { usuarioId: 5, puedeVerTodo: false };
const SCOPE_TOTAL = { usuarioId: 99, puedeVerTodo: true };

function mockPool(overrides = {}) {
  return {
    query: jest.fn().mockResolvedValue([]),
    beginTransaction: jest.fn(),
    ...overrides,
  };
}

function mockTx(queryImpl) {
  return {
    query: queryImpl || jest.fn().mockResolvedValue([]),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
}

describe('ArchivoRepository', () => {
  let repo;
  let pool;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ArchivoRepository();
    pool = mockPool();
    repo.pool = pool;
  });

  describe('getPool', () => {
    it('crea el pool una sola vez (singleton) con la base del servicio', async () => {
      createMysqlPool.mockReturnValue(pool);
      repo.pool = null;

      const first = await repo.getPool();
      const second = await repo.getPool();

      expect(createMysqlPool).toHaveBeenCalledTimes(1);
      expect(createMysqlPool).toHaveBeenCalledWith(
        expect.objectContaining({ database: 'test_storage_db' }),
      );
      expect(first).toBe(second);
    });
  });

  describe('findByUuid', () => {
    it('retorna el archivo con flags booleanos', async () => {
      pool.query.mockResolvedValue([rowFixture]);

      const result = await repo.findByUuid(UUID);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE uuid = ? AND deleted_at IS NULL'),
        [UUID],
      );
      expect(result).toEqual(expect.objectContaining({ publico: false, activo: true }));
    });

    it('retorna null cuando no existe', async () => {
      expect(await repo.findByUuid(UUID)).toBeNull();
    });
  });

  describe('findAll', () => {
    it('restringe a los archivos propios o públicos activos para usuarios comunes', async () => {
      pool.query
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await repo.findAll({ page: 1, limit: 20, scope: SCOPE_PRIVADO });

      const [countSql, countParams] = pool.query.mock.calls[0];
      expect(countSql).toContain('subido_por = ? OR (publico = 1 AND activo = 1)');
      expect(countParams).toEqual([5]);
    });

    it('no aplica restricción de propietario a ADMIN/STAFF', async () => {
      pool.query
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await repo.findAll({ page: 1, limit: 20, scope: SCOPE_TOTAL });

      expect(pool.query.mock.calls[0][0]).not.toContain('publico = 1');
    });

    it('retorna archivos y total numérico con paginación', async () => {
      pool.query
        .mockResolvedValueOnce([{ total: '2' }])
        .mockResolvedValueOnce([rowFixture, rowFixture]);

      const result = await repo.findAll({ page: 1, limit: 20, scope: SCOPE_TOTAL });

      expect(result.total).toBe(2);
      expect(result.files).toHaveLength(2);
      expect(result.files[0].activo).toBe(true);
    });

    it('aplica filtros de tipo, entidad, asociado, carpeta, usuario y activo', async () => {
      pool.query
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await repo.findAll({
        page: 1,
        limit: 10,
        scope: SCOPE_TOTAL,
        usuarioId: 5,
        tipo: 'application/pdf',
        entidad: 'request',
        uuidAsociado: UUID,
        carpeta: 'docs',
        activo: false,
      });

      const [sql, params] = pool.query.mock.calls[0];
      expect(sql).toContain('subido_por = ?');
      expect(sql).toContain('mime_type = ?');
      expect(sql).toContain('entidad_asociada = ?');
      expect(sql).toContain('uuid_asociado = ?');
      expect(sql).toContain('carpeta = ?');
      expect(sql).toContain('activo = ?');
      expect(params).toEqual([5, 'application/pdf', 'request', UUID, 'docs', 0]);
    });

    it('busca por nombre con LIKE escapando comodines', async () => {
      pool.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

      await repo.findAll({ page: 1, limit: 10, scope: SCOPE_TOTAL, search: '50%_off' });

      expect(pool.query.mock.calls[0][0]).toContain('nombre_original LIKE ?');
      expect(pool.query.mock.calls[0][1]).toEqual(['%50\\%\\_off%']);
    });

    it('calcula offset para la página 3', async () => {
      pool.query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);

      await repo.findAll({ page: 3, limit: 10, scope: SCOPE_TOTAL });

      expect(pool.query.mock.calls[1][1]).toEqual([10, 20]);
    });
  });

  describe('create', () => {
    const data = {
      nombreOriginal: 'doc.pdf',
      nombreSistema: 'uuid.pdf',
      rutaAcceso: '/uploads/uuid.pdf',
      mimeType: 'application/pdf',
      pesoBytes: 100,
      extension: '.pdf',
      entidadAsociada: null,
      uuidAsociado: null,
      subidoPor: 5,
      subidoPorNombre: 'Test',
      carpeta: 'general',
      publico: true,
    };

    it('inserta y devuelve la fila leída dentro de la misma transacción', async () => {
      const tx = mockTx(jest.fn()
        .mockResolvedValueOnce({ insertId: 7 })
        .mockResolvedValueOnce([rowFixture]));
      pool.beginTransaction.mockResolvedValue(tx);

      const result = await repo.create(data);

      expect(tx.query.mock.calls[0][0]).toContain('INSERT INTO archivos');
      expect(tx.query.mock.calls[0][1]).toEqual(expect.arrayContaining([
        expect.stringMatching(/^[0-9a-f-]{36}$/),
        'doc.pdf',
        'uuid.pdf',
        'application/pdf',
        100,
        5,
        'Test',
        'general',
        1,
      ]));
      expect(tx.query.mock.calls[1][1]).toEqual([7]);
      expect(tx.commit).toHaveBeenCalled();
      expect(tx.release).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('hace rollback y libera la conexión si falla la inserción', async () => {
      const tx = mockTx(jest.fn().mockRejectedValue(new Error('db fail')));
      pool.beginTransaction.mockResolvedValue(tx);

      await expect(repo.create(data)).rejects.toThrow('db fail');

      expect(tx.rollback).toHaveBeenCalled();
      expect(tx.commit).not.toHaveBeenCalled();
      expect(tx.release).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('actualiza solo los campos enviados y convierte booleanos a 0/1', async () => {
      const tx = mockTx(jest.fn()
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([rowFixture]));
      pool.beginTransaction.mockResolvedValue(tx);

      const result = await repo.update(1, { carpeta: 'nueva', publico: true, activo: false });

      const [sql, params] = tx.query.mock.calls[0];
      expect(sql).toBe(
        'UPDATE archivos SET carpeta = ?, publico = ?, activo = ? WHERE id = ? AND deleted_at IS NULL',
      );
      expect(params).toEqual(['nueva', 1, 0, 1]);
      expect(tx.commit).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('permite limpiar la asociación con null', async () => {
      const tx = mockTx(jest.fn()
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([rowFixture]));
      pool.beginTransaction.mockResolvedValue(tx);

      await repo.update(1, { entidadAsociada: null, uuidAsociado: null });

      expect(tx.query.mock.calls[0][1]).toEqual([null, null, 1]);
    });

    it('no ejecuta UPDATE si no hay campos', async () => {
      const tx = mockTx(jest.fn().mockResolvedValue([rowFixture]));
      pool.beginTransaction.mockResolvedValue(tx);

      await repo.update(1, {});

      expect(tx.query).toHaveBeenCalledTimes(1);
      expect(tx.query.mock.calls[0][0]).toContain('SELECT');
    });

    it('retorna null si el archivo no existe', async () => {
      const tx = mockTx(jest.fn().mockResolvedValue([]));
      pool.beginTransaction.mockResolvedValue(tx);

      expect(await repo.update(999, { carpeta: 'x' })).toBeNull();
    });

    it('hace rollback ante un error', async () => {
      const tx = mockTx(jest.fn().mockRejectedValue(new Error('lock timeout')));
      pool.beginTransaction.mockResolvedValue(tx);

      await expect(repo.update(1, { carpeta: 'x' })).rejects.toThrow('lock timeout');
      expect(tx.rollback).toHaveBeenCalled();
      expect(tx.release).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('aplica soft delete y devuelve true cuando afecta una fila', async () => {
      const tx = mockTx(jest.fn().mockResolvedValue({ affectedRows: 1 }));
      pool.beginTransaction.mockResolvedValue(tx);

      const result = await repo.delete(1);

      expect(tx.query).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = NOW(), activo = 0'),
        [1],
      );
      expect(tx.commit).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('devuelve false si no existe un registro activo', async () => {
      const tx = mockTx(jest.fn().mockResolvedValue({ affectedRows: 0 }));
      pool.beginTransaction.mockResolvedValue(tx);

      expect(await repo.delete(999)).toBe(false);
    });

    it('hace rollback ante un error', async () => {
      const tx = mockTx(jest.fn().mockRejectedValue(new Error('fail')));
      pool.beginTransaction.mockResolvedValue(tx);

      await expect(repo.delete(1)).rejects.toThrow('fail');
      expect(tx.rollback).toHaveBeenCalled();
      expect(tx.release).toHaveBeenCalled();
    });
  });

  describe('searchInElasticsearch', () => {
    const respuesta = (hits) => ({ hits: { total: { value: hits.length }, hits } });

    it('restringe la búsqueda al alcance del usuario', async () => {
      esClient.search.mockResolvedValue(respuesta([]));

      await repo.searchInElasticsearch({ search: 'contrato', scope: SCOPE_PRIVADO, page: 1, limit: 20 });

      const body = esClient.search.mock.calls[0][0];
      expect(body.index).toBe('test_uajs_storage');
      expect(body.query.bool.filter[0].bool.should[0]).toEqual({ term: { subido_por: 5 } });
    });

    it('no añade filtro de propietario para ADMIN/STAFF', async () => {
      esClient.search.mockResolvedValue(respuesta([]));

      await repo.searchInElasticsearch({ search: 'contrato', scope: SCOPE_TOTAL });

      expect(esClient.search.mock.calls[0][0].query.bool.filter).toEqual([]);
    });

    it('calcula from/size y mapea los resultados desde _source', async () => {
      esClient.search.mockResolvedValue(respuesta([{ _source: rowFixture }]));

      const result = await repo.searchInElasticsearch({
        search: 'contrato',
        scope: SCOPE_TOTAL,
        page: 2,
        limit: 5,
      });

      const body = esClient.search.mock.calls[0][0];
      expect(body.from).toBe(5);
      expect(body.size).toBe(5);
      expect(result).toEqual({ total: 1, files: [rowFixture] });
    });

    it('soporta total numérico (compatibilidad ES)', async () => {
      esClient.search.mockResolvedValue({ hits: { total: 4, hits: [] } });

      const result = await repo.searchInElasticsearch({ search: 'x', scope: SCOPE_TOTAL });

      expect(result.total).toBe(4);
    });

    it('escapa comodines del término en la consulta wildcard', async () => {
      esClient.search.mockResolvedValue(respuesta([]));

      await repo.searchInElasticsearch({ search: 'a*b?', scope: SCOPE_TOTAL });

      const should = esClient.search.mock.calls[0][0].query.bool.must[0].bool.should;
      expect(should[1].wildcard['nombre_original.keyword'].value).toBe('*a\\*b\\?*');
    });

    it('agrega filtros de metadatos presentes', async () => {
      esClient.search.mockResolvedValue(respuesta([]));

      await repo.searchInElasticsearch({
        search: 'q',
        scope: SCOPE_TOTAL,
        usuarioId: 3,
        tipo: 'image/png',
        entidad: 'event',
        uuidAsociado: UUID,
        carpeta: 'fotos',
        activo: true,
      });

      const { filter } = esClient.search.mock.calls[0][0].query.bool;
      expect(filter).toEqual([
        { term: { subido_por: 3 } },
        { term: { mime_type: 'image/png' } },
        { term: { entidad_asociada: 'event' } },
        { term: { uuid_asociado: UUID } },
        { term: { carpeta: 'fotos' } },
        { term: { activo: true } },
      ]);
    });
  });
});
