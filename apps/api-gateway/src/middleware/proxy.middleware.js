const { formatError, ERROR_CODES } = require('@uajs/shared-utils');
const { createProxyMiddleware } = require('http-proxy-middleware');

const env = require('../config/env');
const logger = require('../config/logger');

const SERVICE_MAP = {
  '/api/v1/auth': env.SERVICE_AUTH_URL,
  '/api/v1/usuarios': env.SERVICE_USER_URL,
  '/api/v1/catalogos': env.SERVICE_CATALOG_URL,
  '/api/v1/universidad': env.SERVICE_UNIVERSITY_URL,
  '/api/v1/recursos': env.SERVICE_RESOURCE_URL,
  '/api/v1/reservas': env.SERVICE_BOOKING_URL,
  '/api/v1/solicitudes': env.SERVICE_REQUEST_URL,
  '/api/v1/eventos': env.SERVICE_EVENT_URL,
  '/api/v1/notificaciones': env.SERVICE_NOTIFICATION_URL,
  '/api/v1/pqrs': env.SERVICE_PQRS_URL,
  '/api/v1/archivos': env.SERVICE_STORAGE_URL,
};

function onError(err, req, res) {
  const requestId = req.requestId || 'unknown';
  logger.error('Error en proxy', { requestId, error: err.message, code: err.code });

  let statusCode = 502;
  let code = ERROR_CODES.BAD_GATEWAY;
  let message = 'Error de comunicación con el servicio interno';

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    statusCode = 503;
    code = ERROR_CODES.SERVICE_UNAVAILABLE;
    message = 'El servicio interno no está disponible';
  } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
    statusCode = 504;
    code = ERROR_CODES.GATEWAY_TIMEOUT;
    message = 'Tiempo de espera agotado al conectar con el servicio interno';
  }

  if (!res.headersSent) {
    res.status(statusCode).json(formatError({ code, message, requestId }));
  }
}

function onProxyReq(proxyReq, req) {
  // Express ya consumió el body con express.json(): hay que reenviarlo
  // manualmente o el servicio destino se queda esperando (cuelgue/timeout).
  const { body } = req;
  const tieneBody = body && typeof body === 'object' && Object.keys(body).length > 0;
  if (tieneBody && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const bodyData = JSON.stringify(body);
    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
  if (req.user) {
    proxyReq.setHeader('X-User-Id', String(req.user.id));
    proxyReq.setHeader('X-User-Roles', req.user.roles.join(','));
  }
  if (req.requestId) {
    proxyReq.setHeader('X-Request-Id', req.requestId);
  }
}

module.exports = function setupProxy(app) {
  Object.entries(SERVICE_MAP).forEach(([path, target]) => {
    app.use(
      path,
      createProxyMiddleware({
        target,
        changeOrigin: true,
        timeout: 30000, // 30 segundos
        proxyTimeout: 30000,
        onError,
        onProxyReq,
        logLevel: 'warn',
      }),
    );
  });
};
