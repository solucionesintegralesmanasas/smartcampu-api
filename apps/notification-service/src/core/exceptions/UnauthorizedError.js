const AppError = require('./AppError');

/**
 * Error de autenticación (401).
 */
class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') {
    super(message, 401);
  }
}

module.exports = UnauthorizedError;
