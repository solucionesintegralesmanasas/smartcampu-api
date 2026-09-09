const { formatError, ERROR_CODES } = require('@uajs/shared-utils');

const logger = require('../config/logger');

module.exports = function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || ERROR_CODES.INTERNAL_ERROR;

  logger.error('Error no manejado', {
    requestId: req.requestId,
    correlationId: req.correlationId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (!res.headersSent) {
    res.status(statusCode).json(
      formatError({
        code,
        message:
          process.env.NODE_ENV === 'production' && statusCode === 500
            ? 'Error interno del servidor'
            : err.message,
        requestId: req.requestId,
      }),
    );
  }
};
