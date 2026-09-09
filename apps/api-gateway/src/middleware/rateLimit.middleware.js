const { formatError, ERROR_CODES } = require('@uajs/shared-utils');

const env = require('../config/env');
const logger = require('../config/logger');
const defaultTokenBucket = require('../core/rateLimiter/tokenBucket');

/**
 * Crea el middleware de rate limiting usando un Token Bucket.
 *
 * Permite inyectar un bucket para testing (p. ej. de poca capacidad);
 * por defecto usa el singleton del proceso.
 *
 * @param {object} [opts]
 * @param {import('@uajs/shared-utils').TokenBucket} [opts.bucket]
 * @param {number} [opts.capacity]
 * @returns {import('express').RequestHandler}
 */
function createRateLimitMiddleware({
  bucket = defaultTokenBucket,
  capacity = env.RATE_LIMIT_BUCKET_CAPACITY,
} = {}) {
  return function rateLimitMiddleware(req, res, next) {
    const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    const cost = 1;

    const result = bucket.consume(key, cost);

    // X-RateLimit-Limit = capacidad máxima; X-RateLimit-Remaining = tokens restantes
    res.setHeader('X-RateLimit-Limit', String(capacity));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      logger.warn('Rate limit excedido', {
        requestId: req.requestId,
        key,
        retryAfter: result.retryAfterSeconds,
      });
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json(
        formatError({
          code: ERROR_CODES.TOO_MANY_REQUESTS,
          message: 'Demasiadas solicitudes. Por favor, inténtelo más tarde.',
          requestId: req.requestId,
          retryAfterSeconds: result.retryAfterSeconds,
        }),
      );
    }

    next();
  };
}

module.exports = createRateLimitMiddleware;
