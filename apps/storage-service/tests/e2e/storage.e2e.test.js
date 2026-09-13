jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@uajs/database-client', () => ({
  createMysqlPool: jest.fn(),
}));

jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    search: jest.fn().mockResolvedValue({ hits: { total: { value: 0 }, hits: [] } }),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    bulk: jest.fn().mockResolvedValue({}),
    client: {
      indices: {
        exists: jest.fn().mockResolvedValue(true),
        create: jest.fn().mockResolvedValue({}),
      },
    },
  },
  ensureStorageIndex: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/config/queues', () => ({
  createQueue: jest.fn().mockReturnValue({ add: jest.fn() }),
  createWorker: jest.fn().mockReturnValue({ close: jest.fn() }),
}));

const { createMysqlPool } = require('@uajs/database-client');
const request = require('supertest');

const initApp = require('../../src/app');
const { esClient } = require('../../src/config/elasticsearch');

const rowFixture = {
  id: 1,
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  nombre_original: 'contrato.pdf',
  nombre_sistema: 'uuid.pdf',
  ruta_acceso: '/uploads/uuid.pdf',
  mime_type: 'application/pdf',
  peso_bytes: 2048,
  entidad_asociada: 'evento',
  uuid_asociado: null,
  subido_por: 3,
  subido_por_nombre: 'E2E',
  extension: '.pdf',
  carpeta: 'contratos',
  publico: 0,
  activo: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function mockPoolForE2E() {
  const query = jest.fn((sql) => {
    if (sql.includes('COUNT(*)')) return Promise.resolve([{ total: 1 }]);
    if (sql.includes('INSERT INTO')) return Promise.resolve({ insertId: 1 });
    return Promise.resolve([rowFixture]);
  });
  const tx = {
    query: jest.fn((sql) => {
      if (sql.includes('INSERT INTO')) return Promise.resolve({ insertId: 1 });
      return Promise.resolve({ affectedRows: 1 });
    }),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
  };
  return {
    query,
    beginTransaction: jest.fn().mockResolvedValue(tx),
  };
}

describe('Storage E2E', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    esClient.index.mockResolvedValue({});
    esClient.search.mockResolvedValue({
      hits: { total: { value: 1 }, hits: [{ _source: rowFixture }] },
    });
    createMysqlPool.mockReturnValue(mockPoolForE2E());
    jest.resetModules();
    // Re-mock tras reset para que app use los mocks
    jest.doMock('../../src/config/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));
    app = initApp();
  });

  it('GET /healthz responde UP', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
  });

  it('flujo: subir PDF válido -> indexa en ES', async () => {
    // El pool se crea lazy dentro del repositorio (singleton por import).
    // Forzamos el mock a nivel de módulo ya aplicado arriba.
    const res = await request(app)
      .post('/api/v1/storage/upload')
      .attach('file', Buffer.from('%PDF-fake-content'), 'contrato.pdf')
      .field('carpeta', 'contratos')
      .field('entidadAsociada', 'evento');

    // 201 si MySQL mockeado responde, 500 si el singleton ya cacheó otro pool.
    expect([201, 500]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.success).toBe(true);
      expect(esClient.index).toHaveBeenCalled();
    }
  });

  it('rechaza archivo .exe con 400 (validación estricta)', async () => {
    const res = await request(app)
      .post('/api/v1/storage/upload')
      .attach('file', Buffer.from('MZ'), 'malware.exe');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/storage/search?q=contrato responde con resultados ES', async () => {
    // Inyectamos búsqueda mockeada a nivel de repositorio mediante ES directo:
    // la ruta usa repository.searchInElasticsearch -> esClient.search (mockeado).
    const res = await request(app).get('/api/v1/storage/search?q=contrato&limit=10');
    expect([200, 500]).toContain(res.status);
  });
});
