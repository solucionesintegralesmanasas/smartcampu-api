const request = require('supertest');

const initApp = require('../../src/app');
const { esClient } = require('../../src/config/elasticsearch');

jest.mock('../../src/config/database/mysql', () => {
  const mockPool = {
    query: jest.fn().mockImplementation(async (sql, _params) => {
      if (sql.includes('COUNT(*)')) {
        return [{ total: 1 }];
      }
      if (sql.includes('SELECT')) {
        return [
          {
            id: 1,
            nombre: 'Prueba Mock',
            is_active: 1,
            activo: 1,
          },
        ];
      }
      if (sql.includes('INSERT')) {
        return { insertId: 1, affectedRows: 1 };
      }
      if (sql.includes('UPDATE')) {
        return { affectedRows: 1 };
      }
      return [];
    }),
    beginTransaction: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ insertId: 1, affectedRows: 1 }),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      release: jest.fn().mockResolvedValue(),
    }),
    ping: jest.fn().mockResolvedValue(true),
  };

  return {
    getMysqlPool: () => mockPool,
    createMySQLPool: () => mockPool,
  };
});

describe('University Service E2E Tests', () => {
  let app;

  beforeAll(() => {
    app = initApp();
    jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });
    jest.spyOn(esClient.client, 'delete').mockResolvedValue({ body: {} });
    jest.spyOn(esClient.client, 'search').mockResolvedValue({
      body: {
        hits: {
          hits: [{ _source: { id: 1, nombre: 'Resultado ES' } }],
        },
      },
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Health Checks', () => {
    it('GET /healthz debe retornar 200 con status UP', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe('university-service');
    });

    it('GET /api/v1/universidad/health debe retornar 200', async () => {
      const res = await request(app).get('/api/v1/universidad/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
    });
  });

  describe('Endpoints de Empresas', () => {
    it('GET /api/v1/universidad/empresas debe retornar lista paginada', async () => {
      const res = await request(app).get('/api/v1/universidad/empresas');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/v1/universidad/empresas con datos inválidos debe retornar 400', async () => {
      const res = await request(app).post('/api/v1/universidad/empresas').send({ nit: '1' }); // falta razonSocial

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/universidad/empresas/search debe responder con resultados de ES', async () => {
      const res = await request(app).get('/api/v1/universidad/empresas/search?search=Tech');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Endpoints de Terceros', () => {
    it('GET /api/v1/universidad/terceros debe retornar lista', async () => {
      const res = await request(app).get('/api/v1/universidad/terceros');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/v1/universidad/terceros con datos inválidos debe retornar 400', async () => {
      const res = await request(app)
        .post('/api/v1/universidad/terceros')
        .send({ primerNombre: 'SoloNombre' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/v1/universidad/terceros/search debe retornar resultados', async () => {
      const res = await request(app).get('/api/v1/universidad/terceros/search?search=Juan');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Endpoints de Facultades', () => {
    it('GET /api/v1/universidad/facultades debe retornar lista', async () => {
      const res = await request(app).get('/api/v1/universidad/facultades');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Endpoints de Programas', () => {
    it('GET /api/v1/universidad/programas debe retornar lista', async () => {
      const res = await request(app).get('/api/v1/universidad/programas');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Endpoints de Estudiantes', () => {
    it('GET /api/v1/universidad/estudiantes debe retornar lista', async () => {
      const res = await request(app).get('/api/v1/universidad/estudiantes');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Endpoints de Docentes', () => {
    it('GET /api/v1/universidad/docentes debe retornar lista', async () => {
      const res = await request(app).get('/api/v1/universidad/docentes');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
