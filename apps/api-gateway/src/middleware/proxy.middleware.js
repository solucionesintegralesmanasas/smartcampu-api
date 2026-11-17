const { formatError, ERROR_CODES } = require('@uajs/shared-utils');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

const env = require('../config/env');
const logger = require('../config/logger');

// `path` es el prefijo público (en español) que expone el gateway.
// `internalPath` es el prefijo que cada microservicio realmente monta
// internamente (en inglés, ver su express.loader.js). http-proxy-middleware
// reenvía req.originalUrl tal cual cuando se monta vía `app.use(path, mw)`
// (no lo recorta), así que sin este pathRewrite ningún request llegaría a
// una ruta real del servicio interno (solo coincidía por casualidad en
// auth-service, donde ambos prefijos son iguales).
const SERVICE_MAP = {
  '/api/v1/auth': { target: env.SERVICE_AUTH_URL, internalPath: '/api/v1/auth' },
  '/api/v1/usuarios': { target: env.SERVICE_USER_URL, internalPath: '/api/v1/users' },
  '/api/v1/catalogos': { target: env.SERVICE_CATALOG_URL, internalPath: '/api/v1/catalog' },
  '/api/v1/universidad': { target: env.SERVICE_UNIVERSITY_URL, internalPath: '/api/v1/university' },
  '/api/v1/recursos': { target: env.SERVICE_RESOURCE_URL, internalPath: '/api/v1/resources' },
  '/api/v1/reservas': { target: env.SERVICE_BOOKING_URL, internalPath: '/api/v1/bookings' },
  '/api/v1/solicitudes': { target: env.SERVICE_REQUEST_URL, internalPath: '/api/v1/requests' },
  '/api/v1/eventos': { target: env.SERVICE_EVENT_URL, internalPath: '/api/v1/events' },
  '/api/v1/notificaciones': {
    target: env.SERVICE_NOTIFICATION_URL,
    internalPath: '/api/v1/notifications',
  },
  '/api/v1/pqrs': { target: env.SERVICE_PQRS_URL, internalPath: '/api/v1/pqrs' },
  '/api/v1/archivos': { target: env.SERVICE_STORAGE_URL, internalPath: '/api/v1/storage' },
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
  // Nunca confiar en estos headers si vienen del cliente: se eliminan
  // siempre y solo se reinyectan si el gateway mismo autenticó al request.
  // De lo contrario, un cliente podría forjarlos en rutas públicas
  // (login/registro) y suplantar identidad/rol frente al servicio interno.
  proxyReq.removeHeader('X-User-Id');
  proxyReq.removeHeader('X-User-Uuid');
  proxyReq.removeHeader('X-User-Name');
  proxyReq.removeHeader('X-User-Roles');

  if (req.user) {
    proxyReq.setHeader('X-User-Id', String(req.user.id));
    if (req.user.uuid) {
      proxyReq.setHeader('X-User-Uuid', req.user.uuid);
    }
    if (req.user.nombre) {
      // Los headers HTTP no garantizan tránsito seguro de UTF-8 (tildes,
      // ñ, etc.); se codifica y cada servicio lo decodifica al leerlo.
      proxyReq.setHeader('X-User-Name', encodeURIComponent(req.user.nombre));
    }
    proxyReq.setHeader('X-User-Roles', req.user.roles.join(','));
  }
  if (req.requestId) {
    proxyReq.setHeader('X-Request-Id', req.requestId);
  }

  // Prueba de que la petición pasó por el gateway: los servicios internos
  // deben rechazar X-User-Id/X-User-Roles si este token no coincide con el
  // suyo propio, en vez de confiar en cualquier caller que les hable directo.
  proxyReq.setHeader('X-Service-Token', env.SERVICE_AUTH_TOKEN);

  // express.json()/express.urlencoded() (montados antes del proxy en
  // app.js) ya consumieron el stream original del request al parsear
  // req.body. http-proxy-middleware en modo stream reenvía ese stream ya
  // vacío, pero conserva el Content-Length original: el servicio interno
  // se queda esperando bytes que nunca llegan y el request se cuelga hasta
  // que el socket revienta (ECONNRESET). fixRequestBody vuelve a serializar
  // req.body y ajusta Content-Length antes de reenviar.
  //
  // DEBE ir al final: fixRequestBody escribe el body y cierra el request
  // (proxyReq.end()) de inmediato, así que cualquier proxyReq.setHeader(...)
  // posterior a esta llamada se ignora en silencio (los headers ya se
  // enviaron al abrir el body). Por eso X-User-Id/X-User-Roles llegaban
  // vacíos a los servicios internos en cada POST/PUT/PATCH proxiado.
  fixRequestBody(proxyReq, req);
}

module.exports = function setupProxy(app) {
  Object.entries(SERVICE_MAP).forEach(([path, { target, internalPath }]) => {
    app.use(
      path,
      createProxyMiddleware({
        target,
        changeOrigin: true,
        timeout: 30000, // 30 segundos
        proxyTimeout: 30000,
        pathRewrite: { [`^${path}`]: internalPath },
        onError,
        onProxyReq,
        logLevel: 'warn',
      }),
    );
  });
};
