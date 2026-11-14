const AppError = require('./AppError');

/**
 * Error de prohibido (403).
 */
class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(message, 403);
  }
}
module.exports = ForbiddenError;
