const jwt = require('jsonwebtoken');

const { env } = require('../../../src/config/env');
const { ForbiddenError, UnauthorizedError } = require('../../../src/core/exceptions');
const { requireAuth, requireRole } = require('../../../src/core/middlewares/auth.middleware');

const crearRes = () => ({});

describe('auth.middleware', () => {
  describe('requireAuth', () => {
    it('llama next con UnauthorizedError si no hay cabecera Authorization', () => {
      const next = jest.fn();

      requireAuth({ headers: {} }, crearRes(), next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('rechaza cabeceras que no usan el esquema Bearer', () => {
      const next = jest.fn();

      requireAuth({ headers: { authorization: 'Basic abc' } }, crearRes(), next);

      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('rechaza un token que no se puede verificar', () => {
      const next = jest.fn();

      requireAuth({ headers: { authorization: 'Bearer token.invalido' } }, crearRes(), next);

      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
      expect(next.mock.calls[0][0].message).toBe('Token de acceso inválido o expirado');
    });

    it('adjunta userId (número) y userRole cuando el token es válido', () => {
      const token = jwt.sign({ sub: 42, rol: 'STAFF' }, env.JWT_SECRET, { expiresIn: '5m' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();

      requireAuth(req, crearRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.userId).toBe(42);
      expect(req.userRole).toBe('STAFF');
    });

    it('acepta sub numérico en cadena', () => {
      const token = jwt.sign({ sub: '7', rol: 'STUDENT' }, env.JWT_SECRET, { expiresIn: '5m' });
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();

      requireAuth(req, crearRes(), next);

      expect(req.userId).toBe(7);
    });

    it('deja userRole en null si el token no trae rol', () => {
      const token = jwt.sign({ sub: 9 }, env.JWT_SECRET, { expiresIn: '5m' });
      const req = { headers: { authorization: `Bearer ${token}` } };

      requireAuth(req, crearRes(), jest.fn());

      expect(req.userRole).toBeNull();
    });

    it('rechaza un sub que no es entero positivo', () => {
      const token = jwt.sign({ sub: -1, rol: 'ADMIN' }, env.JWT_SECRET, { expiresIn: '5m' });
      const next = jest.fn();

      requireAuth({ headers: { authorization: `Bearer ${token}` } }, crearRes(), next);

      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('requireRole', () => {
    it('permite el paso cuando el rol está en la lista', () => {
      const next = jest.fn();

      requireRole('ADMIN', 'STAFF')({ userId: 1, userRole: 'STAFF' }, crearRes(), next);

      expect(next).toHaveBeenCalledWith();
    });

    it('responde ForbiddenError cuando el rol no está permitido', () => {
      const next = jest.fn();

      requireRole('ADMIN')({ userId: 1, userRole: 'STUDENT' }, crearRes(), next);

      expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
    });

    it('responde ForbiddenError cuando el token no trae rol', () => {
      const next = jest.fn();

      requireRole('ADMIN')({ userId: 1, userRole: null }, crearRes(), next);

      expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
    });

    it('responde UnauthorizedError si requireAuth no se ejecutó antes', () => {
      const next = jest.fn();

      requireRole('ADMIN')({ headers: {} }, crearRes(), next);

      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });
  });
});
