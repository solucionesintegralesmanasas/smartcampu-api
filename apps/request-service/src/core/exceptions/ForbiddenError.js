const AppError = require('./AppError');

class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para realizar esta acción') {
    super(message, 403);
  }
}

module.exports = ForbiddenError;
