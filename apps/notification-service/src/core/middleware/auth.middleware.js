const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const { ForbiddenError, UnauthorizedError } = require('../exceptions');

/**
 * Exige un Bearer JWT válido firmado con env.JWT_SECRET.
 * Adjunta `req.user = { id, rol }` (id = claim `sub`, rol = claim `rol`).
 */
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token de acceso no proporcionado');
    }
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.sub === undefined || payload.sub === null) {
      throw new UnauthorizedError('Token de acceso inválido');
    }
    req.user = { id: payload.sub, rol: payload.rol || null };
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
 * Restringe una ruta a los roles indicados. Debe usarse después de requireAuth.
 * @param {...string} roles - Roles permitidos (ej. USER_ROLES.ADMIN).
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    next(new UnauthorizedError('Token de acceso no proporcionado'));
    return;
  }
  if (!roles.includes(req.user.rol)) {
    next(new ForbiddenError('No tiene permisos para realizar esta acción'));
    return;
  }
  next();
};

module.exports = { requireAuth, requireRole };
