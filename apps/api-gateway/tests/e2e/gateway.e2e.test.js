const http = require('node:http');

const jwt = require('jsonwebtoken');
const request = require('supertest');

let capturedRequest = null;

function startMockServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      capturedRequest = { url: req.url, headers: { ...req.headers } };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ from: 'mock-user-service' }));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

describe('API Gateway E2E', () => {
  let mock;
  let app;
  const secret = 'e2e_secret_key_min_32_characters_long_for_test';

  beforeAll(async () => {
    mock = await startMockServer();

    // Cargar app apuntando user-service al mock y con rate limit bajo
    jest.resetModules();
    process.env.JWT_SECRET = secret;
    process.env.RATE_LIMIT_BUCKET_CAPACITY = '3';
    process.env.RATE_LIMIT_REFILL_PER_SEC = '10';
    process.env.SERVICE_USER_URL = `http://127.0.0.1:${mock.port}`;

    app = require('../../src/app');
  });

  afterAll(async () => {
    if (mock) mock.server.close();
  });

  it('GET /health debe retornar 200 y estado up', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('up');
    expect(res.body.service).toBe('api-gateway');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('services');
  });

  it('Ruta protegida sin token debe retornar 401', async () => {
    const res = await request(app).get('/api/v1/usuarios');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('Token válido debe hacer proxy al servicio destino e inyectar headers', async () => {
    const token = jwt.sign({ sub: 99, roles: ['ESTUDIANTE'] }, secret, { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/v1/usuarios/42')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ from: 'mock-user-service' });
    expect(capturedRequest.url).toBe('/api/v1/usuarios/42');
    expect(capturedRequest.headers['x-user-id']).toBe('99');
    expect(capturedRequest.headers['x-user-roles']).toBe('ESTUDIANTE');
    expect(capturedRequest.headers['x-request-id']).toBeDefined();
  });

  it('Debe retornar 429 con Retry-After al exceder el rate limit', async () => {
    const token = jwt.sign({ sub: 7, roles: ['ESTUDIANTE'] }, secret, { expiresIn: '1h' });

    let status = null;
    let body = null;
    let headers = null;
    // La capacidad es 3; hacemos peticiones hasta agotar el bucket.
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- peticiones E2E secuenciales de rate limit
      const res = await request(app)
        .get('/api/v1/usuarios')
        .set('Authorization', `Bearer ${token}`);
      ({ status, body, headers } = res);
      if (status === 429) break;
    }

    expect(status).toBe(429);
    expect(body.code).toBe('TOO_MANY_REQUESTS');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(headers['retry-after']).toBeDefined();
  });
});
