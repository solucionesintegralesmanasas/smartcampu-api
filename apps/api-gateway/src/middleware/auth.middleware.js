const { formatError, ERROR_CODES } = require('@uajs/shared-utils');
const jwt = require('jsonwebtoken');

const env = require('../config/env');
const logger = require('../config/logger');

// Rutas que no exigen Authorization. El token de acceso no puede servir para
// nada que lo renueve o lo cancele, porque esos casos ocurren justo cuando el
// accessToken ya caducó o ya no es fiable:
//   - refresh: su payload lleva el refreshToken a renovar (DEF-01 corregido);
//   - logout: cierra sesión con el refreshToken, no con el accessToken;
//   - password-reset(/confirm): flujo olvidé-mi-contraseña, público por
//     definición y con el nombre real de las rutas de auth-service
//     (antes solo estaba `reset-password`, que no existe allí).
const PUBLIC_ROUTES = [
  '/health',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/password-reset',
  '/api/v1/auth/password-reset/confirm',
];

module.exports = function authMiddleware(req, res, next) {
  if (PUBLIC_ROUTES.some((route) => req.path.startsWith(route))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Auth fallido: falta token', { requestId: req.requestId, path: req.path });
    return res.status(401).json(
      formatError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Token de acceso no proporcionado',
        requestId: req.requestId,
      }),
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (!payload.sub || !payload.uuid || !Array.isArray(payload.roles)) {
      throw new Error('Payload JWT inválido: falta sub, uuid o roles');
    }

    req.user = {
      id: payload.sub,
      uuid: payload.uuid,
      nombre: payload.nombre || null,
      roles: payload.roles,
    };
    next();
  } catch (err) {
    logger.warn('Auth fallido: token inválido o expirado', {
      requestId: req.requestId,
      error: err.message,
    });
    return res.status(401).json(
      formatError({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Token de acceso inválido o expirado',
        requestId: req.requestId,
      }),
    );
  }
};
