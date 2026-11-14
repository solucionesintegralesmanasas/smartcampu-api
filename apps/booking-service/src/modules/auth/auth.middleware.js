const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const { ForbiddenError, UnauthorizedError } = require('../../core/exceptions');

const { tieneRol } = require('./auth.roles');

/**
 * Middleware que exige un access token válido firmado con JWT_SECRET.
 * Adjunta `req.user` con id, uuid, nombre, roles y el token original.
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
    if (!payload.uuid) {
      throw new UnauthorizedError('El token no incluye el identificador del usuario (uuid)');
    }
    req.user = {
      id: payload.sub,
      uuid: payload.uuid,
      nombre: payload.nombre || payload.correo || 'Usuario',
      roles: payload.rol ? [payload.rol] : [],
      token,
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
 * Middleware que restringe la ruta a usuarios con alguno de los roles indicados.
 * Debe ejecutarse después de requireAuth.
 * @param {...string} roles - Roles permitidos.
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!tieneRol(req.user, roles)) {
    next(new ForbiddenError('No tiene permisos para realizar esta acción'));
    return;
  }
  next();
};

module.exports = { requireAuth, requireRole };
