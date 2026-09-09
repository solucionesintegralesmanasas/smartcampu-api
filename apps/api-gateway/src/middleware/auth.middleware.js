const { formatError, ERROR_CODES } = require('@uajs/shared-utils');
const jwt = require('jsonwebtoken');

const env = require('../config/env');
const logger = require('../config/logger');

const PUBLIC_ROUTES = [
  '/health',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/reset-password/confirm',
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

    if (!payload.sub || !Array.isArray(payload.roles)) {
      throw new Error('Payload JWT inválido: falta sub o roles');
    }

    req.user = {
      id: payload.sub,
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
