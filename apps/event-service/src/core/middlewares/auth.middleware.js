const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const { ForbiddenError, UnauthorizedError } = require('../exceptions');

/**
 * Extrae el usuario autenticado a partir del token Bearer.
 * Acepta `rol` (auth-service) o `roles` (versiones anteriores).
 * @param {string} authHeader - Cabecera Authorization.
 * @returns {{id: string, uuid: string, nombre: string|null, roles: string[]}}
 */
const extraerUsuario = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token de acceso no proporcionado');
  }
  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    throw new UnauthorizedError('Token de acceso inválido o expirado');
  }
  if (!payload.sub) {
    throw new UnauthorizedError('Token de acceso inválido');
  }
  const roles = Array.isArray(payload.roles) ? payload.roles : [payload.rol].filter(Boolean);
  return {
    id: payload.sub,
    uuid: payload.uuid || String(payload.sub),
    nombre: payload.nombre || payload.correo || null,
    roles,
  };
};

/**
 * Exige un token de acceso válido. Adjunta el usuario como `req.user`.
 */
const requireAuth = (req, res, next) => {
  try {
    req.user = extraerUsuario(req.headers.authorization);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Autenticación opcional: sin cabecera deja `req.user = null`;
 * con cabecera inválida responde 401.
 */
const optionalAuth = (req, res, next) => {
  if (!req.headers.authorization) {
    req.user = null;
    next();
    return;
  }
  requireAuth(req, res, next);
};

/**
 * Exige que el usuario autenticado tenga alguno de los roles indicados.
 * @param {...string} roles - Roles permitidos.
 */
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) {
      next(new UnauthorizedError('Token de acceso no proporcionado'));
      return;
    }
    const autorizado = req.user.roles.some((rol) => roles.includes(rol));
    if (!autorizado) {
      next(new ForbiddenError('No tienes permisos para realizar esta acción'));
      return;
    }
    next();
  };

module.exports = { extraerUsuario, requireAuth, optionalAuth, requireRole };
