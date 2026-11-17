const { env } = require('../../config/env');
const logger = require('../../config/logger');

/**
 * Puebla req.user a partir de X-User-Id/X-User-Roles, pero SOLO si la
 * petición trae el X-Service-Token que el api-gateway inyecta en cada
 * request proxiada (ver api-gateway/src/middleware/proxy.middleware.js).
 *
 * Sin esta verificación, cualquiera que le hable directo al puerto interno
 * de este servicio (sin pasar por el gateway) podría forjar X-User-Id y
 * suplantar a cualquier usuario. Si el token no coincide, req.user queda
 * sin definir (equivalente a anónimo) en vez de confiar en los headers.
 */
function identityMiddleware(req, res, next) {
  const serviceToken = req.headers['x-service-token'];

  if (serviceToken !== env.SERVICE_AUTH_TOKEN) {
    if (serviceToken !== undefined) {
      logger.warn('X-Service-Token inválido: se ignoran los headers de identidad', {
        path: req.path,
      });
    }
    return next();
  }

  const userId = req.headers['x-user-id'];
  const userUuid = req.headers['x-user-uuid'];
  const userName = req.headers['x-user-name'];
  const rolesHeader = req.headers['x-user-roles'];

  if (userId) {
    req.user = {
      id: Number(userId),
      uuid: userUuid,
      nombre: userName ? decodeURIComponent(userName) : null,
      roles: rolesHeader ? rolesHeader.split(',').filter(Boolean) : [],
    };
  }

  next();
}

module.exports = identityMiddleware;
