const jwt = require('jsonwebtoken');

const { env } = require('../../config/env');
const { UnauthorizedError } = require('../../core/exceptions');

/**
 * Middleware que exige un token de acceso válido.
 * Adjunta el id del usuario como `req.userId` para los controladores.
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
    req.userId = payload.sub;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Token de acceso inválido o expirado'));
  }
};

module.exports = { requireAuth };
