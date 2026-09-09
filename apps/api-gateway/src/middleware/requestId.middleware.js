const { generateUuid } = require('@uajs/shared-utils');

module.exports = function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || generateUuid();
  const correlationId = req.headers['x-correlation-id'] || requestId;

  req.requestId = requestId;
  req.correlationId = correlationId;

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);
  next();
};
