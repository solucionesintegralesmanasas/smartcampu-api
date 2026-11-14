const jwt = require('jsonwebtoken');

const { env } = require('../../src/config/env');
const { ForbiddenError, UnauthorizedError } = require('../../src/core/exceptions');
const {
  requireAuth,
  requireRole,
  catalogWriteAccess,
} = require('../../src/modules/auth/auth.middleware');

const runMiddleware = (middleware, req) => {
  const next = jest.fn();
  middleware(req, {}, next);
  return next;
};

describe('auth.middleware (Unit Tests)', () => {
  describe('requireAuth', () => {
    it('debe rechazar la petición sin cabecera Authorization', () => {
      const next = runMiddleware(requireAuth, { headers: {} });

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('debe rechazar un esquema distinto de Bearer', () => {
      const next = runMiddleware(requireAuth, { headers: { authorization: 'Basic abc' } });

      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('debe rechazar un token con firma inválida', () => {
      const next = runMiddleware(requireAuth, {
        headers: { authorization: 'Bearer token.invalido.aqui' },
      });

      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
      expect(next.mock.calls[0][0].message).toBe('Token de acceso inválido o expirado');
    });

    it('debe rechazar un token expirado', () => {
      const expired = jwt.sign(
        { sub: 1, rol: 'ADMIN', exp: Math.floor(Date.now() / 1000) - 60 },
        env.JWT_SECRET,
      );
      const next = runMiddleware(requireAuth, { headers: { authorization: `Bearer ${expired}` } });

      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
    });

    it('debe rechazar un token sin claim sub', () => {
      const token = jwt.sign({ rol: 'ADMIN' }, env.JWT_SECRET);
      const next = runMiddleware(requireAuth, { headers: { authorization: `Bearer ${token}` } });

      expect(next.mock.calls[0][0]).toBeInstanceOf(UnauthorizedError);
      expect(next.mock.calls[0][0].message).toBe('Token de acceso inválido');
    });

    it('debe adjuntar userId y userRole con un token válido', () => {
      const token = jwt.sign({ sub: 42, rol: 'STAFF' }, env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = runMiddleware(requireAuth, req);

      expect(next).toHaveBeenCalledWith();
      expect(req.userId).toBe(42);
      expect(req.userRole).toBe('STAFF');
    });

    it('debe asignar userRole null si el token no trae rol', () => {
      const token = jwt.sign({ sub: 7 }, env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      runMiddleware(requireAuth, req);

      expect(req.userRole).toBeNull();
    });
  });

  describe('requireRole', () => {
    it('debe permitir el paso si el rol está autorizado', () => {
      const next = runMiddleware(requireRole('ADMIN', 'STAFF'), { userRole: 'ADMIN' });

      expect(next).toHaveBeenCalledWith();
    });

    it('debe responder 403 si el rol no está autorizado', () => {
      const next = runMiddleware(requireRole('ADMIN'), { userRole: 'STUDENT' });

      expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('catalogWriteAccess', () => {
    it('debe exigir autenticación y rol ADMIN o STAFF', () => {
      expect(catalogWriteAccess).toHaveLength(2);

      const token = jwt.sign({ sub: 1, rol: 'TEACHER' }, env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      catalogWriteAccess[0](req, {}, () => catalogWriteAccess[1](req, {}, next));

      expect(next.mock.calls[0][0]).toBeInstanceOf(ForbiddenError);
    });
  });
});
