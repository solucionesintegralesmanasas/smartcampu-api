const AppError = require('./AppError');

/**
 * Error de no autorizado (401).
 */
class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401);
  }
}
module.exports = UnauthorizedError;
