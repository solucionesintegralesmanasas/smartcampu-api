const AppError = require('./AppError');

class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') {
    super(message, 401);
  }
}

module.exports = UnauthorizedError;
