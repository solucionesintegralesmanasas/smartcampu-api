const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const env = require('../../src/config/env');
const authMiddleware = require('../../src/middleware/auth.middleware');

const app = express();
app.use(express.json());
app.use(authMiddleware);
app.get('/protected', (req, res) => res.json({ user: req.user }));
app.get('/api/v1/auth/login', (req, res) => res.json({ msg: 'public' }));

describe('Auth Middleware', () => {
  it('debe permitir acceso a rutas públicas sin token', async () => {
    const res = await request(app).get('/api/v1/auth/login');
    expect(res.status).toBe(200);
  });

  it('debe retornar 401 si falta el token en ruta protegida', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('debe retornar 401 si el token está expirado', async () => {
    const expiredToken = jwt.sign({ sub: 1, roles: ['USER'] }, env.JWT_SECRET, {
      expiresIn: '-1h',
    });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('debe inyectar req.user si el token es válido', async () => {
    const validToken = jwt.sign({ sub: 123, roles: ['ADMIN'] }, env.JWT_SECRET, {
      expiresIn: '1h',
    });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 123, roles: ['ADMIN'] });
  });
});
