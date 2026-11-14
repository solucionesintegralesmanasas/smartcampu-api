const AppError = require('./AppError');

/**
 * Error de conflicto (409).
 */
class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual del recurso') {
    super(message, 409);
  }
}

module.exports = ConflictError;
