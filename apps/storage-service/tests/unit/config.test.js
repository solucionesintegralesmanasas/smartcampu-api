describe('configuración del servicio', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('config/elasticsearch ensureStorageIndex', () => {
    it('crea el índice cuando no existe (respuesta boolean v8)', async () => {
      jest.doMock('@uajs/shared-elasticsearch', () => ({
        createElasticsearchClient: jest.fn().mockReturnValue({
          client: {
            indices: {
              exists: jest.fn().mockResolvedValue(false),
              create: jest.fn().mockResolvedValue({}),
            },
          },
        }),
      }));

      const { ensureStorageIndex } = require('../../src/config/elasticsearch');
      await expect(ensureStorageIndex()).resolves.toBeUndefined();
    });

    it('crea el índice cuando no existe (respuesta legacy con body)', async () => {
      jest.doMock('@uajs/shared-elasticsearch', () => ({
        createElasticsearchClient: jest.fn().mockReturnValue({
          client: {
            indices: {
              exists: jest.fn().mockResolvedValue({ body: false }),
              create: jest.fn().mockResolvedValue({}),
            },
          },
        }),
      }));

      const { ensureStorageIndex } = require('../../src/config/elasticsearch');
      await expect(ensureStorageIndex()).resolves.toBeUndefined();
    });

    it('no crea el índice cuando ya existe', async () => {
      const createMock = jest.fn();
      jest.doMock('@uajs/shared-elasticsearch', () => ({
        createElasticsearchClient: jest.fn().mockReturnValue({
          client: {
            indices: {
              exists: jest.fn().mockResolvedValue(true),
              create: createMock,
            },
          },
        }),
      }));

      const { ensureStorageIndex } = require('../../src/config/elasticsearch');
      await ensureStorageIndex();
      expect(createMock).not.toHaveBeenCalled();
    });

    it('no lanza si ES no está disponible', async () => {
      jest.doMock('@uajs/shared-elasticsearch', () => ({
        createElasticsearchClient: jest.fn().mockReturnValue({
          client: {
            indices: {
              exists: jest.fn().mockRejectedValue(new Error('ES down')),
              create: jest.fn(),
            },
          },
        }),
      }));

      const { ensureStorageIndex } = require('../../src/config/elasticsearch');
      await expect(ensureStorageIndex()).resolves.toBeUndefined();
    });
  });

  describe('config/logger', () => {
    it('expone un logger con métodos estándar', () => {
      jest.doMock('winston-elasticsearch', () => {
        // eslint-disable-next-line import/no-extraneous-dependencies, global-require
        const Transport = require('winston-transport');
        return {
          ElasticsearchTransport: class MockESTransport extends Transport {
            log(info, callback) {
              callback();
            }
          },
        };
      });

      const logger = require('../../src/config/logger');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('config/database/mysql', () => {
    it('crea el pool y retorna conexión exitosa', async () => {
      const getConnectionMock = jest.fn().mockResolvedValue({ release: jest.fn() });
      jest.doMock('mysql2/promise', () => ({
        createPool: jest.fn().mockReturnValue({ getConnection: getConnectionMock }),
      }));

      const { createMySQLPool } = require('../../src/config/database/mysql');
      const pool = await createMySQLPool();
      expect(pool).toBeDefined();
      expect(getConnectionMock).toHaveBeenCalled();
    });

    it('reintenta ante fallo transitorio y luego conecta', async () => {
      const getConnectionMock = jest
        .fn()
        .mockRejectedValueOnce(new Error('temporal'))
        .mockResolvedValue({ release: jest.fn() });
      jest.doMock('mysql2/promise', () => ({
        createPool: jest.fn().mockReturnValue({ getConnection: getConnectionMock }),
      }));
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 0;
      });

      const { createMySQLPool } = require('../../src/config/database/mysql');
      await expect(createMySQLPool()).resolves.toBeDefined();

      global.setTimeout.mockRestore();
    });

    it('lanza error tras agotar reintentos', async () => {
      jest.doMock('mysql2/promise', () => ({
        createPool: jest.fn().mockReturnValue({
          getConnection: jest.fn().mockRejectedValue(new Error('caído')),
        }),
      }));
      jest.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return 0;
      });

      const { createMySQLPool } = require('../../src/config/database/mysql');
      await expect(createMySQLPool()).rejects.toThrow(/MySQL/);

      global.setTimeout.mockRestore();
    }, 15000);
  });

  describe('config/database/redis', () => {
    it('retorna singleton del cliente Redis', () => {
      const clientMock = { on: jest.fn() };
      jest.doMock('@uajs/database-client', () => ({
        createRedisClient: jest.fn().mockReturnValue(clientMock),
      }));

      const { getRedisClient } = require('../../src/config/database/redis');
      const first = getRedisClient();
      const second = getRedisClient();
      expect(first).toBe(second);
      expect(first).toBe(clientMock);
    });
  });

  describe('config/queues', () => {
    it('createQueue y createWorker delegan en BullMQ', () => {
      const QueueMock = jest.fn().mockImplementation(() => ({ add: jest.fn() }));
      const WorkerMock = jest.fn().mockImplementation(() => ({ close: jest.fn() }));
      jest.doMock('bullmq', () => ({ Queue: QueueMock, Worker: WorkerMock }));

      const { createQueue, createWorker } = require('../../src/config/queues');
      const processor = jest.fn();
      createQueue('cola-test');
      createWorker('cola-test', processor);

      expect(QueueMock).toHaveBeenCalledWith('cola-test', expect.objectContaining({ connection: expect.any(Object) }));
      expect(WorkerMock).toHaveBeenCalledWith('cola-test', processor, expect.objectContaining({ connection: expect.any(Object) }));
    });
  });
});
