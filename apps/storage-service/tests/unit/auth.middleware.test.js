const jwt = require('jsonwebtoken');

const { env } = require('../../src/config/env');
const { requireAuth, optionalAuth } = require('../../src/core/middlewares/auth.middleware');
const { UnauthorizedError } = require('../../src/core/exceptions');

const reqWithToken = (token) => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

const signToken = (payload, options = { expiresIn: '1h' }) => jwt.sign(
  payload,
  env.JWT_SECRET,
  options,
);

describe('auth.middleware (storage-service)', () => {
  describe('requireAuth', () => {
    it('rechaza peticiones sin token con 401', () => {
      const next = jest.fn();
      requireAuth({ headers: {} }, {}, next);

      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.statusCode).toBe(401);
    });

    it('rechaza encabezados que no son Bearer', () => {
      const next = jest.fn();
      requireAuth({ headers: { authorization: 'Basic abc' } }, {}, next);
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('rechaza tokens firmados con otro secreto', () => {
      const next = jest.fn();
      const token = jwt.sign({ sub: 1 }, 'otro_secreto_distinto_con_longitud_suficiente_para_test_1234567890');
      requireAuth(reqWithToken(token), {}, next);
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('rechaza tokens expirados', () => {
      const next = jest.fn();
      const token = jwt.sign({ sub: 1 }, env.JWT_SECRET, { expiresIn: -10 });
      requireAuth(reqWithToken(token), {}, next);
      expect(next.mock.calls[0][0].message).toMatch(/inválido o expirado/);
    });

    it('rechaza tokens cuyo sub no es un id numérico positivo', () => {
      const next = jest.fn();
      requireAuth(reqWithToken(signToken({ sub: 'abc' })), {}, next);
      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);

      const next2 = jest.fn();
      requireAuth(reqWithToken(signToken({})), {}, next2);
      expect(next2.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('adjunta id, nombre y roles normalizados en req.user', () => {
      const req = reqWithToken(signToken({ sub: '7', nombre: 'Ana', rol: 'staff' }));
      const next = jest.fn();

      requireAuth(req, {}, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({ id: 7, nombre: 'Ana', roles: ['STAFF'] });
    });

    it('acepta el claim roles como arreglo', () => {
      const req = reqWithToken(signToken({ sub: 3, roles: ['ADMIN', 'teacher'] }));
      requireAuth(req, {}, jest.fn());
      expect(req.user.roles).toEqual(['ADMIN', 'TEACHER']);
      expect(req.user.nombre).toBeNull();
    });
  });

  describe('optionalAuth', () => {
    it('continúa sin usuario cuando no hay token', () => {
      const req = { headers: {} };
      const next = jest.fn();
      optionalAuth(req, {}, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });

    it('adjunta el usuario cuando el token es válido', () => {
      const req = reqWithToken(signToken({ sub: 5, rol: 'STUDENT' }));
      optionalAuth(req, {}, jest.fn());
      expect(req.user).toEqual({ id: 5, nombre: null, roles: ['STUDENT'] });
    });

    it('trata un token inválido como anónimo sin propagar error', () => {
      const req = reqWithToken('token-malformado');
      const next = jest.fn();
      optionalAuth(req, {}, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });
  });
});
