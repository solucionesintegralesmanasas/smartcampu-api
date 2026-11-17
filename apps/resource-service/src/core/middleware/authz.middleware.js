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

/**
 * Exige que la petición traiga un X-Service-Token válido, sin importar si
 * viene identidad de usuario final. Para endpoints internos llamados por
 * otros microservicios.
 */
function requireTrustedService(req, res, next) {
  if (!req.isTrustedService) {
    return next(new UnauthorizedError('Esta ruta solo puede ser llamada por servicios internos'));
  }
  return next();
}

/**
 * Para endpoints que sirven tanto a un usuario final (a través del gateway,
 * con X-User-Id) como a otro microservicio consultando solo con
 * X-Service-Token y sin identidad de usuario adjunta (p. ej.
 * booking-service#getResource validando que un recurso existe antes de
 * crear una reserva/préstamo). requireAuth por sí solo rechazaba esa
 * segunda llamada con 401, y booking-service lo interpretaba como "recurso
 * no encontrado".
 */
function requireAuthOrTrustedService(req, res, next) {
  if (req.isTrustedService || req.user) {
    return next();
  }
  return next(new UnauthorizedError('Autenticación requerida'));
}

module.exports = {
  requireAuth, requireRole, requireTrustedService, requireAuthOrTrustedService,
};
