const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const { ForbiddenError, UnauthorizedError } = require('../../core/exceptions');

const ROLES_ESCRITURA = ['ADMIN', 'STAFF'];

/**
 * Middleware que exige un token de acceso válido emitido por auth-service.
 * Adjunta `req.userId` y `req.userRole` (claim `rol`) para los controladores.
 */
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acceso no proporcionado');
    }
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload.sub) {
      throw new UnauthorizedError('Token de acceso inválido');
    }
    req.userId = payload.sub;
    req.userRole = payload.rol || null;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Token de acceso inválido o expirado'));
  }
};

/**
 * Middleware que restringe el acceso a los roles indicados.
 * Debe usarse después de `requireAuth`.
 * @param {...string} allowedRoles - Roles permitidos.
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.userRole)) {
    next(new ForbiddenError('No tiene permisos para realizar esta acción'));
    return;
  }
  next();
};

/** Cadena de middlewares para rutas de escritura del catálogo (ADMIN o STAFF). */
const catalogWriteAccess = [requireAuth, requireRole(...ROLES_ESCRITURA)];

module.exports = {
  requireAuth,
  requireRole,
  catalogWriteAccess,
  ROLES_ESCRITURA,
};
