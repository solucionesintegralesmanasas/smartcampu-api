const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const { ForbiddenError, UnauthorizedError } = require('../exceptions');

/**
 * Middleware que exige un Bearer JWT válido firmado con JWT_SECRET (emitido por auth-service).
 * Adjunta `req.user` con: id (sub numérico), uuid, nombre, correo y rol.
 * El token de auth-service no incluye UUID: se usa el id numérico como identificador.
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
    req.user = {
      id: payload.sub,
      uuid: payload.uuid || String(payload.sub),
      nombre: payload.nombre || null,
      correo: payload.correo || null,
      rol: payload.rol || null,
    };
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
 * Middleware que restringe el acceso a los roles indicados. Debe usarse después de requireAuth.
 * @param {...string} roles - Roles permitidos (p. ej. 'STAFF', 'ADMIN').
 */
const requireRoles =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      next(new ForbiddenError('No tienes permisos para realizar esta acción'));
      return;
    }
    next();
  };

module.exports = { requireAuth, requireRoles };
