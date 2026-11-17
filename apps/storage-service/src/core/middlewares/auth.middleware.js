const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const { UnauthorizedError } = require('../exceptions');

/**
 * Extrae el token Bearer del encabezado Authorization.
 * @returns {string|null} Token o null si no existe.
 */
const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1] || null;
};

/**
 * Construye el actor a partir de los claims del JWT emitido por auth-service.
 * `sub` es el id numérico del usuario; `rol` (o `roles`) contiene los roles.
 */
const buildActor = (payload) => {
  const id = Number(payload.sub);
  if (!Number.isInteger(id) || id <= 0) {
    throw new UnauthorizedError('Token de acceso inválido');
  }
  const roles = [].concat(payload.rol || [], payload.roles || [])
    .map((role) => String(role).toUpperCase());
  return { id, nombre: payload.nombre || null, roles };
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch (error) {
    throw new UnauthorizedError('Token de acceso inválido o expirado');
  }
};

/**
 * Exige un token de acceso válido. Adjunta el actor en `req.user`.
 */
const requireAuth = (req, res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new UnauthorizedError('Token de acceso no proporcionado');
    req.user = buildActor(verifyToken(token));
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Adjunta `req.user` si hay un token válido. Un token inválido se trata como
 * anónimo: el servicio decide si el recurso es accesible sin autenticación.
 */
const optionalAuth = (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) return next();
  try {
    req.user = buildActor(verifyToken(token));
  } catch (error) {
    req.user = undefined;
  }
  return next();
};

module.exports = { requireAuth, optionalAuth };
