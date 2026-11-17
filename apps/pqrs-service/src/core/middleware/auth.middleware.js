const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const { ForbiddenError, UnauthorizedError } = require('../exceptions');

/**
 * Verifica el Bearer JWT y devuelve el usuario, o null si no hay cabecera válida.
 * @param {import('express').Request} req
 * @returns {{ id: any, uuid: string, nombre: string|null, correo: string|null, rol: string|null }|null}
 */
const resolverUsuario = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const payload = jwt.verify(authHeader.split(' ')[1], env.JWT_SECRET);
  if (!payload.sub) {
    throw new UnauthorizedError('Token de acceso inválido');
  }
  return {
    id: payload.sub,
    uuid: payload.uuid || String(payload.sub),
    nombre: payload.nombre || null,
    correo: payload.correo || null,
    rol: payload.rol || null,
  };
};

/**
 * Middleware que exige un Bearer JWT válido (emitido por auth-service).
 * Adjunta `req.user` con: id (sub), uuid, nombre, correo y rol.
 */
const requireAuth = (req, res, next) => {
  try {
    const usuario = resolverUsuario(req);
    if (!usuario) {
      throw new UnauthorizedError('Token de acceso no proporcionado');
    }
    req.user = usuario;
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
 * Middleware que resuelve el usuario si viene un token, pero no lo exige.
 * Se usa en endpoints públicos que se enriquecen cuando hay sesión (p. ej. radicar PQRS).
 */
const optionalAuth = (req, res, next) => {
  try {
    req.user = resolverUsuario(req);
    next();
  } catch (error) {
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

module.exports = { requireAuth, optionalAuth, requireRoles };
