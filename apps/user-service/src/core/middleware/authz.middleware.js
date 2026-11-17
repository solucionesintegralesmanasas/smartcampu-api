const { ForbiddenError, UnauthorizedError } = require('../exceptions');

/**
 * Exige que identityMiddleware haya podido establecer req.user (token de
 * servicio válido + X-User-Id presente).
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new UnauthorizedError('Autenticación requerida'));
  }
  return next();
}

/**
 * Exige que req.user tenga al menos uno de los roles dados. Usar después de
 * requireAuth.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Autenticación requerida'));
    }
    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return next(new ForbiddenError('No tienes el rol requerido para esta acción'));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
