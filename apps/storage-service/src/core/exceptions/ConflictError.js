const AppError = require('./AppError');

/**
 * Error de conflicto (409).
 */
class ConflictError extends AppError {
  constructor(message = 'Conflicto de recursos') {
    super(message, 409);
  }
}
module.exports = ConflictError;
