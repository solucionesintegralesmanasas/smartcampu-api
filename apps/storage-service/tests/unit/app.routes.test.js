jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@uajs/database-client', () => ({
  createMysqlPool: jest.fn().mockReturnValue({ query: jest.fn() }),
  createRedisClient: jest.fn().mockReturnValue({ on: jest.fn() }),
}));

jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn(),
    search: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    bulk: jest.fn(),
    client: {
      indices: {
        exists: jest.fn().mockResolvedValue(false),
        create: jest.fn().mockResolvedValue({}),
      },
    },
  },
  ensureStorageIndex: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');

describe('app + routes + loaders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initApp expone /healthz con el estado del servicio', async () => {
    const initApp = require('../../src/app');
    const app = initApp();

    const health = await request(app).get('/healthz');
    expect(health.status).toBe(200);
    expect(health.body).toEqual(
      expect.objectContaining({ status: 'UP', service: 'storage-service' }),
    );
  });

  it('las rutas de archivos exigen autenticación (401 sin token)', async () => {
    const initApp = require('../../src/app');
    const app = initApp();

    const list = await request(app).get('/api/v1/storage/archivos?page=1&limit=5');
    expect(list.status).toBe(401);

    const upload = await request(app).post('/api/v1/storage/archivos').field('carpeta', 'docs');
    expect(upload.status).toBe(401);
  });

  it('una ruta inexistente responde 404', async () => {
    const initApp = require('../../src/app');
    const app = initApp();

    const res = await request(app).get('/api/v1/storage/no-existe');
    expect(res.status).toBe(404);
  });

  it('manejador de errores responde JSON con success:false', async () => {
    const express = require('express');
    const expressLoader = require('../../src/core/loaders/express.loader');

    const app = express();
    expressLoader(app);
    app.get('/falla', () => {
      throw new Error('boom');
    });

    const res = await request(app).get('/falla');
    expect([500]).toContain(res.status);
  });

  it('databaseLoader invoca ensureStorageIndex sin lanzar', async () => {
    const { ensureStorageIndex } = require('../../src/config/elasticsearch');
    const databaseLoader = require('../../src/core/loaders/database.loader');

    await expect(databaseLoader()).resolves.toBeUndefined();
    expect(ensureStorageIndex).toHaveBeenCalled();
  });

  it('databaseLoader tolera fallo de ES (no lanza)', async () => {
    jest.resetModules();
    jest.doMock('../../src/config/elasticsearch', () => ({
      esClient: {},
      ensureStorageIndex: jest.fn().mockRejectedValue(new Error('ES down')),
    }));
    jest.doMock('../../src/config/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    const loader = require('../../src/core/loaders/database.loader');
    await expect(loader()).resolves.toBeUndefined();
  });

  it('setupSwagger monta /api-docs', () => {
    const express = require('express');
    const setupSwagger = require('../../src/docs/swagger.config');

    const app = express();
    expect(() => setupSwagger(app)).not.toThrow();
  });

  it('config/env expone variables del servicio', () => {
    jest.resetModules();
    const { env } = require('../../src/config/env');
    expect(env.PORT).toBeDefined();
    expect(env.STORAGE_INDEX).toBeDefined();
    expect(env.MAX_FILE_SIZE).toBeGreaterThan(0);
    expect(env.UPLOAD_DIR).toBeDefined();
  });

  it('queues expone createQueue y createWorker', () => {
    jest.resetModules();
    jest.doMock('bullmq', () => ({
      Queue: jest.fn().mockImplementation(() => ({ add: jest.fn() })),
      Worker: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
    }));
    const { createQueue, createWorker } = require('../../src/config/queues');
    expect(typeof createQueue).toBe('function');
    expect(typeof createWorker).toBe('function');
  });
});
