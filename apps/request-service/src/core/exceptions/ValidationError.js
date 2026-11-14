const AppError = require('./AppError');

/**
 * Error de validación (400).
 */
class ValidationError extends AppError {
  constructor(message = 'Error de validación', errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}
module.exports = ValidationError;
