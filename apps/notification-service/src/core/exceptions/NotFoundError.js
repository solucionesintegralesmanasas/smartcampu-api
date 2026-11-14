const AppError = require('./AppError');

/**
 * Error de recurso no encontrado (404).
 */
class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
  }
}

module.exports = NotFoundError;
