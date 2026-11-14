const AppError = require('./AppError');

/**
 * Error de conflicto o transición no permitida (409).
 */
class ConflictError extends AppError {
  constructor(message = 'Conflicto de recursos o violación de integridad') {
    super(message, 409);
  }
}

module.exports = ConflictError;
