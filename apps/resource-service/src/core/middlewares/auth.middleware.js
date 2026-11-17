const crypto = require('crypto');

const jwt = require('jsonwebtoken');

const { USER_ROLES } = require('@uajs/shared-types');

const { env } = require('../../config/env');
const { ForbiddenError, UnauthorizedError } = require('../exceptions');

const WRITE_ROLES = [USER_ROLES.ADMIN, USER_ROLES.STAFF];

/**
 * Extrae el token de un encabezado `Authorization: Bearer <token>`.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
};

/**
 * Compara dos cadenas en tiempo constante.
 */
const safeEqual = (a, b) => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
};

/**
 * Exige un JWT de usuario válido (firmado con JWT_SECRET).
 * Adjunta los claims en `req.user`.
 */
const requireAuth = (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    next(new UnauthorizedError('Token de acceso no proporcionado'));
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload.sub) {
      throw new UnauthorizedError('Token de acceso inválido');
    }
    req.user = {
      sub: payload.sub,
      uuid: payload.uuid || null,
      rol: payload.rol || null,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };
    next();
  } catch (error) {
    next(new UnauthorizedError('Token de acceso inválido o expirado'));
  }
};

/**
 * Exige que el usuario autenticado tenga rol ADMIN o STAFF.
 * Debe usarse después de `requireAuth`.
 */
const requireWriteRole = (req, res, next) => {
  const roles = [req.user?.rol, ...(req.user?.roles || [])].filter(Boolean);
  if (!roles.some((role) => WRITE_ROLES.includes(role))) {
    next(new ForbiddenError('Se requiere rol ADMIN o STAFF para esta operación'));
    return;
  }
  next();
};

/**
 * Acepta el SERVICE_AUTH_TOKEN (inter-servicios, p. ej. booking-service) o un JWT de usuario.
 */
const requireUserOrService = (req, res, next) => {
  const token = extractBearerToken(req);
  if (token && safeEqual(token, env.SERVICE_AUTH_TOKEN)) {
    req.caller = { type: 'service' };
    next();
    return;
  }
  requireAuth(req, res, next);
};

module.exports = { requireAuth, requireWriteRole, requireUserOrService, WRITE_ROLES };
