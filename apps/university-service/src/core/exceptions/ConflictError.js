const AppError = require('./AppError');

class ConflictError extends AppError {
  constructor(message = 'Conflicto de recursos o violación de integridad') {
    super(message, 409);
  }
}

module.exports = ConflictError;
