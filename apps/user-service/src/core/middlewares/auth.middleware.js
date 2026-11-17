const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const { ForbiddenError, UnauthorizedError } = require('../exceptions');

/**
 * Middleware que exige un Bearer JWT válido firmado con JWT_SECRET.
 * El claim `sub` es el id numérico del usuario en uajs_auth; el claim `rol`
 * es el rol de mayor jerarquía emitido por auth-service.
 * Adjunta `req.userId` y `req.userRole` para los controladores.
 */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Token de acceso no proporcionado'));
  }

  let payload;
  try {
    payload = jwt.verify(authHeader.split(' ')[1], env.JWT_SECRET);
  } catch (error) {
    return next(new UnauthorizedError('Token de acceso inválido o expirado'));
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new UnauthorizedError('Token de acceso inválido'));
  }

  req.userId = userId;
  req.userRole = payload.rol || null;
  return next();
};

/**
 * Middleware de autorización por rol. Debe ejecutarse después de requireAuth.
 * @param {...string} allowedRoles - Roles permitidos (ej. 'ADMIN', 'STAFF').
 * @returns {Function} Middleware de Express.
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.userId) {
    return next(new UnauthorizedError('Token de acceso no proporcionado'));
  }
  if (!allowedRoles.includes(req.userRole)) {
    return next(new ForbiddenError('No tiene permisos para realizar esta acción'));
  }
  return next();
};

module.exports = { requireAuth, requireRole };
