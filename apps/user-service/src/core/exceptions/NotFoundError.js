const AppError = require('./AppError');

/**
 * Error de no encontrado (404).
 */
class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
  }
}
module.exports = NotFoundError;
