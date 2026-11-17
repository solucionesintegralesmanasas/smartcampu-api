const { env } = require('../../config/env');
const logger = require('../../config/logger');

/**
 * Puebla req.user a partir de X-User-Id/X-User-Roles, y marca
 * req.isTrustedService, pero SOLO si la petición trae el X-Service-Token
 * que el api-gateway inyecta en cada request proxiada (ver
 * api-gateway/src/middleware/proxy.middleware.js) o que otro microservicio
 * envía en una llamada directa autenticada con el mismo secreto.
 *
 * Sin esta verificación, cualquiera que le hable directo al puerto interno
 * de este servicio podría forjar X-User-Id y suplantar a cualquier usuario.
 * req.isTrustedService permite además rutas de solo-servicio (como
 * "by-user/:uuid", usada por user-service para el perfil polimórfico) que
 * no llevan identidad de usuario final, solo el secreto compartido.
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

  req.isTrustedService = true;

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
