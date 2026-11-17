const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const mockQuery = jest.fn();

jest.mock('../../../src/config/database/mysql', () => ({
  getMysqlPool: () => ({ query: (...args) => mockQuery(...args) }),
  closeMysqlPool: jest.fn(),
}));

const { env } = require('../../../src/config/env');
const usuarioRoutes = require('../../../src/modules/usuario/usuario.routes');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/usuarios', usuarioRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  });
  return app;
};

const tokenPara = (rol, sub = 1) => jwt.sign({ sub, rol }, env.JWT_SECRET, { expiresIn: '5m' });

const perfil = {
  id: 1,
  userId: 42,
  firstName: 'Ana',
  lastName: 'Pérez',
};

describe('usuario.routes (autenticación y roles)', () => {
  let app;

  beforeEach(() => {
    mockQuery.mockReset();
    app = buildApp();
  });

  describe('autenticación', () => {
    it('responde 401 sin token', async () => {
      const res = await request(app).get('/api/v1/usuarios/me');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: 'Token de acceso no proporcionado',
      });
    });

    it('responde 401 con un token firmado con otra clave', async () => {
      const token = jwt.sign({ sub: 1, rol: 'ADMIN' }, 'otra_clave_distinta', { expiresIn: '5m' });

      const res = await request(app)
        .get('/api/v1/usuarios/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('responde 401 con un token expirado', async () => {
      const token = jwt.sign(
        { sub: 1, rol: 'ADMIN', exp: Math.floor(Date.now() / 1000) - 10 },
        env.JWT_SECRET,
      );

      const res = await request(app)
        .get('/api/v1/usuarios/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('responde 401 si el sub no es un id numérico válido', async () => {
      const token = jwt.sign({ sub: 'abc', rol: 'ADMIN' }, env.JWT_SECRET, { expiresIn: '5m' });

      const res = await request(app)
        .get('/api/v1/usuarios/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });
  });

  describe('autorización por rol', () => {
    it('permite a cualquier usuario autenticado consultar su propio perfil', async () => {
      mockQuery.mockResolvedValueOnce([perfil]);

      const res = await request(app)
        .get('/api/v1/usuarios/me')
        .set('Authorization', `Bearer ${tokenPara('STUDENT', 42)}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(perfil);
      expect(mockQuery.mock.calls[0][1]).toEqual([42]);
    });

    it('responde 403 a un ESTUDIANTE que intenta listar usuarios', async () => {
      const res = await request(app)
        .get('/api/v1/usuarios')
        .set('Authorization', `Bearer ${tokenPara('STUDENT')}`);

      expect(res.status).toBe(403);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('responde 403 a un DOCENTE que intenta consultar otro perfil', async () => {
      const res = await request(app)
        .get('/api/v1/usuarios/42')
        .set('Authorization', `Bearer ${tokenPara('TEACHER')}`);

      expect(res.status).toBe(403);
    });

    it('permite a STAFF listar perfiles con paginación', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([perfil]);

      const res = await request(app)
        .get('/api/v1/usuarios?page=1&limit=10&search=Ana')
        .set('Authorization', `Bearer ${tokenPara('STAFF')}`);

      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({
        page: 1, limit: 10, total: 1, totalPages: 1,
      });
      expect(res.body.data).toEqual([perfil]);
    });

    it('permite a ADMIN consultar un perfil por id', async () => {
      mockQuery.mockResolvedValueOnce([perfil]);

      const res = await request(app)
        .get('/api/v1/usuarios/42')
        .set('Authorization', `Bearer ${tokenPara('ADMIN')}`);

      expect(res.status).toBe(200);
      expect(res.body.data.userId).toBe(42);
    });

    it('responde 403 a STAFF que intenta eliminar un perfil', async () => {
      const res = await request(app)
        .delete('/api/v1/usuarios/42')
        .set('Authorization', `Bearer ${tokenPara('STAFF')}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('No tiene permisos para realizar esta acción');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('permite a ADMIN eliminar un perfil (borrado lógico)', async () => {
      mockQuery.mockResolvedValueOnce({ affectedRows: 1 });

      const res = await request(app)
        .delete('/api/v1/usuarios/42')
        .set('Authorization', `Bearer ${tokenPara('ADMIN')}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ message: 'Perfil eliminado correctamente' });
    });
  });

  describe('validación de entrada', () => {
    it('responde 400 con detalle de campos cuando el perfil es inválido', async () => {
      const res = await request(app)
        .put('/api/v1/usuarios/me')
        .set('Authorization', `Bearer ${tokenPara('STUDENT', 42)}`)
        .send({ firstName: 'A' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'firstName' }),
        expect.objectContaining({ field: 'lastName' }),
      ]));
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('responde 400 si limit supera 100', async () => {
      const res = await request(app)
        .get('/api/v1/usuarios?limit=500')
        .set('Authorization', `Bearer ${tokenPara('ADMIN')}`);

      expect(res.status).toBe(400);
    });

    it('responde 400 si userId no es numérico', async () => {
      const res = await request(app)
        .get('/api/v1/usuarios/abc')
        .set('Authorization', `Bearer ${tokenPara('ADMIN')}`);

      expect(res.status).toBe(400);
    });
  });

  describe('respuestas de negocio', () => {
    it('responde 404 cuando el usuario autenticado aún no tiene perfil', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/usuarios/me')
        .set('Authorization', `Bearer ${tokenPara('STUDENT', 42)}`);

      expect(res.status).toBe(404);
    });

    it('crea el perfil con PUT /me cuando los datos son válidos', async () => {
      mockQuery
        .mockResolvedValueOnce({ affectedRows: 1, insertId: 1 })
        .mockResolvedValueOnce([perfil]);

      const res = await request(app)
        .put('/api/v1/usuarios/me')
        .set('Authorization', `Bearer ${tokenPara('STUDENT', 42)}`)
        .send({ firstName: 'Ana', lastName: 'Pérez' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(perfil);
    });

    it('devuelve preferencias por defecto cuando no existen', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/usuarios/me/preferencias')
        .set('Authorization', `Bearer ${tokenPara('STUDENT', 42)}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(expect.objectContaining({
        userId: 42, notifyEmail: true, notifyPush: true,
      }));
    });

    it('rechaza preferencias con horario de silencio incompleto', async () => {
      const res = await request(app)
        .put('/api/v1/usuarios/me/preferencias')
        .set('Authorization', `Bearer ${tokenPara('STUDENT', 42)}`)
        .send({ quietHoursStart: '22:00' });

      expect(res.status).toBe(400);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('responde 404 al consultar el perfil de un usuario inexistente', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/usuarios/999')
        .set('Authorization', `Bearer ${tokenPara('STAFF')}`);

      expect(res.status).toBe(404);
    });
  });
});
