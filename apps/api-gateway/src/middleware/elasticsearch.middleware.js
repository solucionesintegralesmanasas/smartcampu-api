const { esClient } = require('../config/elasticsearch');

function logLevelFromStatus(statusCode) {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
}

const elasticsearchMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', async () => {
    const duration = Date.now() - start;
    const logData = {
      service: 'api-gateway',
      level: logLevelFromStatus(res.statusCode),
      message: `${req.method} ${req.path} ${res.statusCode}`,
      correlationId: req.correlationId,
      requestId: req.requestId,
      userId: req.user?.id,
      http: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      },
    };

    try {
      await esClient.index({
        index: `uajs_gateway_logs-${new Date().toISOString().split('T')[0]}`,
        body: { '@timestamp': new Date().toISOString(), ...logData },
      });
    } catch {
      // Fallback silencioso
    }
  });

  next();
};

module.exports = elasticsearchMiddleware;
