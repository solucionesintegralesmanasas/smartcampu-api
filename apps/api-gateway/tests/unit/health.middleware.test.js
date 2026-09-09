jest.mock('@uajs/database-client', () => ({
  createMysqlPool: jest.fn(),
  createRedisClient: jest.fn(),
}));

jest.mock('@uajs/shared-utils', () => {
  const actual = jest.requireActual('@uajs/shared-utils');
  return {
    ...actual,
    generateUuid: jest.fn(() => 'uuid-test'),
  };
});

jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    client: {
      cluster: { health: jest.fn() },
    },
  },
}));

jest.mock('../../src/config/logger', () => {
  const log = jest.fn();
  return {
    info: log,
    warn: log,
    error: log,
    debug: log,
  };
});

const { createMysqlPool, createRedisClient } = require('@uajs/database-client');
const { generateUuid } = require('@uajs/shared-utils');
const express = require('express');
const request = require('supertest');

const { esClient } = require('../../src/config/elasticsearch');
const health = require('../../src/middleware/health.middleware');

function buildApp() {
  const app = express();
  app.use((req, res, next) => {
    req.correlationId = 'corr-fixed';
    next();
  });
  app.get('/health/liveness', health.livenessHandler);
  app.get('/health/readiness', health.readinessHandler);
  app.get('/health/metrics', health.prometheusMetricsHandler);
  return app;
}

describe('Health Middleware', () => {
  let mysqlPoolMock;
  let redisMock;

  beforeEach(() => {
    jest.clearAllMocks();
    health.shutdown();

    mysqlPoolMock = {
      query: jest.fn().mockResolvedValue([[{ 1: 1 }]]),
      close: jest.fn().mockResolvedValue(undefined),
    };
    redisMock = {
      ping: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(undefined),
    };
    createMysqlPool.mockReturnValue(mysqlPoolMock);
    createRedisClient.mockReturnValue(redisMock);
    esClient.client.cluster.health.mockResolvedValue({ status: 'green' });
    generateUuid.mockReturnValue('uuid-test');
  });

  afterAll(() => {
    health.shutdown();
  });

  describe('liveness', () => {
    it('debe responder 200 inmediato sin tocar dependencias', async () => {
      const app = buildApp();
      const start = Date.now();
      const res = await request(app).get('/health/liveness');
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.pid).toBe(process.pid);
      expect(mysqlPoolMock.query).not.toHaveBeenCalled();
      expect(redisMock.ping).not.toHaveBeenCalled();
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('readiness - todos UP', () => {
    it('debe responder 200 con status UP cuando todas las dependencias están sanas', async () => {
      const app = buildApp();
      await health.pollOnce();
      const res = await request(app).get('/health/readiness');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.details.mysql_auth.status).toBe('UP');
      expect(res.body.details.redis_perimeter.status).toBe('UP');
      expect(res.body.details.elasticsearch.status).toBe('UP');
      expect(res.body.details.disk_space.status).toBe('UP');
      expect(res.body.version).toBeDefined();
      expect(res.body.uptime).toMatch(/days?, \d+ hours?, \d+ minutes?/);
    });
  });

  describe('readiness - MySQL DOWN', () => {
    it('debe responder 503 con status DOWN si MySQL de Auth falla (núcleo)', async () => {
      mysqlPoolMock.query.mockRejectedValue(new Error('ECONNREFUSED'));
      const app = buildApp();

      await health.pollOnce();
      const res = await request(app).get('/health/readiness');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('DOWN');
      expect(res.body.details.mysql_auth.status).toBe('DOWN');
    });
  });

  describe('readiness - Elasticsearch con error 500', () => {
    it('debe responder 200 con status DEGRADED si Elasticsearch devuelve 500', async () => {
      const err = new Error('Internal Server Error');
      err.meta = { statusCode: 500 };
      err.statusCode = 500;
      esClient.client.cluster.health.mockRejectedValue(err);

      const app = buildApp();
      await health.pollOnce();
      const res = await request(app).get('/health/readiness');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.details.elasticsearch.status).toBe('DEGRADED');
      expect(res.body.details.elasticsearch.message).toMatch(/Response time/i);
      expect(res.body.details.mysql_auth.status).toBe('UP');
    });
  });

  describe('readiness - Redis timeout', () => {
    it('debe responder 200 con status DEGRADED si Redis agota su tiempo', async () => {
      redisMock.ping.mockImplementation(
        () => new Promise((_, reject) => {
          const e = new Error('Timeout after 2000ms');
          e.name = 'HealthTimeoutError';
          setImmediate(() => reject(e));
        }),
      );

      const app = buildApp();
      await health.pollOnce();
      const res = await request(app).get('/health/readiness');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DEGRADED');
      expect(res.body.details.redis_perimeter.status).toBe('DOWN');
    });

    it('no debe tumbar el proceso cuando Redis lanza excepción', async () => {
      redisMock.ping.mockRejectedValue(new Error('ECONNRESET'));
      await expect(health.pollOnce()).resolves.toBeDefined();
    });
  });

  describe('readiness - cache local de ciclo corto', () => {
    it('debe reusar el snapshot cacheado sin volver a llamar dependencias', async () => {
      const app = buildApp();
      await health.pollOnce();
      const before = {
        mysqlCalls: mysqlPoolMock.query.mock.calls.length,
        redisCalls: redisMock.ping.mock.calls.length,
        esCalls: esClient.client.cluster.health.mock.calls.length,
      };

      await request(app).get('/health/readiness');
      await request(app).get('/health/readiness');

      const after = {
        mysqlCalls: mysqlPoolMock.query.mock.calls.length,
        redisCalls: redisMock.ping.mock.calls.length,
        esCalls: esClient.client.cluster.health.mock.calls.length,
      };

      expect(after.mysqlCalls).toBe(before.mysqlCalls);
      expect(after.redisCalls).toBe(before.redisCalls);
      expect(after.esCalls).toBe(before.esCalls);
    });
  });

  describe('prometheus metrics', () => {
    it('debe exponer texto plano con metricas en formato Prometheus', async () => {
      const app = buildApp();
      await health.pollOnce();
      const res = await request(app).get('/health/metrics');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text).toMatch(/# HELP api_gateway_up/);
      expect(res.text).toMatch(/api_gateway_up 1/);
      expect(res.text).toMatch(/api_gateway_dependency_up\{dependency="mysql_auth"\} 1/);
      expect(res.text).toMatch(/api_gateway_dependency_up\{dependency="redis_perimeter"\} 1/);
      expect(res.text).toMatch(/api_gateway_dependency_up\{dependency="elasticsearch"\} 1/);
    });
  });

  describe('correlation-id en logs', () => {
    it('debe incluir correlationId UUID en logs de falla de dependencia', async () => {
      const logger = require('../../src/config/logger');
      mysqlPoolMock.query.mockRejectedValue(new Error('Connection refused'));
      generateUuid.mockReturnValue('uuid-correlation-test');

      await health.pollOnce();

      const errorCalls = logger.error.mock.calls;
      const found = errorCalls.some((c) => {
        try {
          const payload = JSON.parse(c[0]);
          return (
            payload.correlationId === 'uuid-correlation-test'
            && payload.dependency === 'auth_mysql'
            && payload.service === 'api-gateway'
          );
        } catch (_) {
          return false;
        }
      });
      expect(found).toBe(true);
    });
  });
});
