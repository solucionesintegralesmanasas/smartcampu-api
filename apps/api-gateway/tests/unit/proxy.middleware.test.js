const http = require('node:http');

const express = require('express');
const request = require('supertest');

// Registros que captura el servidor destino mock.
let capturedRequest = null;

function startMockServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      capturedRequest = {
        url: req.url,
        headers: { ...req.headers },
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ from: 'mock-service' }));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

describe('Proxy Middleware', () => {
  let mock;
  let app;
  let setupProxy;

  beforeEach(async () => {
    capturedRequest = null;
    mock = await startMockServer();

    // Apunta el servicio de usuarios al mock y recarga el módulo con el nuevo env.
    jest.resetModules();
    process.env.SERVICE_USER_URL = `http://127.0.0.1:${mock.port}`;
    setupProxy = require('../../src/middleware/proxy.middleware');

    app = express();
    // Simula requestId + auth previos al proxy
    app.use((req, res, next) => {
      req.requestId = 'req-test-123';
      req.user = { id: 99, roles: ['ADMIN', 'ESTUDIANTE'] };
      next();
    });
    setupProxy(app);
  });

  afterEach(() => {
    if (mock) mock.server.close();
    delete process.env.SERVICE_USER_URL;
  });

  it('debe ruteo al servicio correcto conservando el path /api/v1', async () => {
    await request(app).get('/api/v1/usuarios/42');
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest.url).toBe('/api/v1/usuarios/42');
  });

  it('debe inyectar los headers X-User-Id, X-User-Roles y X-Request-Id', async () => {
    await request(app).get('/api/v1/usuarios');
    expect(capturedRequest.headers['x-user-id']).toBe('99');
    expect(capturedRequest.headers['x-user-roles']).toBe('ADMIN,ESTUDIANTE');
    expect(capturedRequest.headers['x-request-id']).toBe('req-test-123');
  });
});
