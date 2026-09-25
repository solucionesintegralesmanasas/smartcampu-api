# api-gateway — Documentación detallada por carpeta

> Puerto 3000. Rol: borde de seguridad, enrutado y observabilidad. Sin lógica de negocio ni base de datos propia.
> Estructura real: `src/app.js`, `server.js`, `config/`, `core/rateLimiter/`, `middleware/`, `routes/`. No tiene `modules/`, `jobs/` ni `docs/` en `src/`.

## 1. Raíz `src/` — `app.js` y `server.js`

### `src/app.js`

- Propósito: composición de la aplicación Express. Define el orden: `helmet -> cors -> json/urlencoded 10mb -> requestId -> elasticsearch -> healthRoutes -> auth -> rateLimit -> proxy -> 404 -> errorHandler`.
- Exporta: `app`.
- Dependencias: `express-async-errors`, `cors`, `express`, `helmet`, `@uajs/shared-utils` (`formatError`, `ERROR_CODES`).

### `src/server.js`

- Propósito: arranque HTTP y apagado ordenado.
- Lógica: `app.listen(PORT)`, `gracefulShutdown` cierra HTTP, llama `tokenBucket.stop()`, salida 0, forzado a 10s con `unref()`. Escucha `SIGTERM/SIGINT`.
- Dependencias: `./app`, `./config/env`, `./config/logger`, `./core/rateLimiter/tokenBucket`.

## 2. Carpeta `src/config/`

### `config/env.js`

- Propósito: validación estricta con Zod. Carga `.env` de `apps/api-gateway/.env`.
- Exporta: `PORT 3000`, `NODE_ENV`, `JWT_SECRET` mínimo 32, `CORS_ALLOWED_ORIGINS` cadena a arreglo, `RATE_LIMIT_BUCKET_CAPACITY 100`, `RATE_LIMIT_REFILL_PER_SEC 10`, 11 `SERVICE_*_URL` obligatorias tipo `url()`: `AUTH, USER, CATALOG, UNIVERSITY, RESOURCE, BOOKING, REQUEST, EVENT, NOTIFICATION, PQRS, STORAGE`.
- Falla con `process.exit(1)` si inválido.

### `config/logger.js`

- Propósito: singleton Winston para el gateway.
- Exporta: `logger` vía `createLogger` con nivel `debug` salvo `production info`.

### `config/elasticsearch.js`

- Propósito: cliente ES para logs.
- Exporta: `{ esClient }` con `ELASTICSEARCH_HOST/PORT/USER/PASSWORD` o `elasticsearch:9200/elastic/changeme`.

## 3. Carpeta `src/core/rateLimiter/`

### `core/rateLimiter/tokenBucket.js`

- Propósito: singleton TokenBucket en memoria del proceso.
- Exporta: `bucket` creado con `createTokenBucket` (`capacity`, `refillPerSecond`, `sweepIntervalMs 60000`).
- Se detiene en `server.js` con `stop()`.

## 4. Carpeta `src/middleware/` — 7 archivos

### `middleware/requestId.middleware.js`

- Exporta `requestIdMiddleware`.
- Lee `x-request-id` o genera con `generateUuid()`, `x-correlation-id` o reutiliza `requestId`. Asigna `req.requestId`, `req.correlationId` y cabeceras `X-Request-Id`, `X-Correlation-Id`.

### `middleware/auth.middleware.js`

- Exporta `authMiddleware`.
- Públicas por `startsWith`: `/health`, `/api/v1/auth/login`, `/register`, `/refresh`, `/password-reset`, `/password-reset/confirm`, compat `/reset-password`, `/reset-password/confirm`.
- Exige `Authorization Bearer`, verifica con `jwt.verify(token, JWT_SECRET)`, acepta `roles[]` o `rol` singular, exige `sub` y 1 rol, inyecta `req.user = { id, roles }`. Error `401 UNAUTHORIZED`.

### `middleware/rateLimit.middleware.js`

- Exporta `createRateLimitMiddleware({ bucket, capacity })`.
- Clave `user:{id}` si autenticado sino `ip:{ip}`, `bucket.consume(key,1)`, cabeceras `X-RateLimit-Limit/Remaining`, `429` con `Retry-After` y `TOO_MANY_REQUESTS` si no permitido.

### `middleware/proxy.middleware.js`

- Exporta `setupProxy(app)`.
- Mapa: `/api/v1/auth->AUTH`, `/usuarios->USER`, `/catalogos->CATALOG`, `/universidad->UNIVERSITY`, `/recursos->RESOURCE`, `/reservas->BOOKING`, `/solicitudes->REQUEST`, `/eventos->EVENT`, `/notificaciones->NOTIFICATION`, `/pqrs->PQRS`, `/archivos->STORAGE`.
- `onError`: `503` si `ECONNREFUSED/ENOTFOUND`, `504` si timeout, sino `502`.
- `onProxyReq`: reinyecta cuerpo JSON consumido por `express.json()`, propaga `X-User-Id`, `X-User-Roles`, `X-Request-Id`. Opciones `changeOrigin true`, `timeout/proxyTimeout 30000`.

### `middleware/elasticsearch.middleware.js`

- Exporta `elasticsearchMiddleware`.
- En `res.on finish` indexa en `uajs_gateway_logs-AAAA-MM-DD`: `{ timestamp, service api-gateway, level según estado, message, correlationId, requestId, userId, http { method, path, statusCode, duration, ip, userAgent } }`. Fallo silencioso.

### `middleware/errorHandler.middleware.js`

- Exporta `errorHandler(err, req, res, next)`.
- Usa `err.statusCode || 500`, oculta mensaje en producción si 500, registra con `requestId`, `correlationId`, `stack`, `path`, `method`.

### `middleware/health.middleware.js` — 379 líneas

- Exporta `{ livenessHandler, readinessHandler, prometheusMetricsHandler, buildHealthPayload, pollOnce, ensurePolling, shutdown }`.
- `livenessHandler`: `200 { status UP, service api-gateway, pid, timestamp }`.
- `readinessHandler`: agrega snapshot cacheado 12s y responde `httpStatus`.
- `prometheusMetricsHandler`: texto `api_gateway_up`, `api_gateway_dependency_up`, `api_gateway_dependency_latency_ms`.
- Sondas con `opossum` timeout 2000: `mysql_auth SELECT 1`, `redis_perimeter ping`, `elasticsearch cluster.health 1s`, `disk_space freemem`.
- Regla: MySQL caído `DOWN 503`, Redis o ES caídos `DEGRADED 200`.

## 5. Carpeta `src/routes/`

### `routes/health.routes.js`

- Exporta `router`. Llama `ensurePolling()` al importar.
- `GET /health/liveness`, `GET /health/readiness`, `GET /health/metrics`.

### `routes/index.routes.js`

- Exporta `router` vacío intencional. El proxy se inyecta en `app.js` para mantener orden.

## 6. Carpeta `tests/` — fuera de `src/`

- `tests/setup.js`: fija `JWT_SECRET 32+`, 11 `SERVICE_*_URL`, `CORS`, `RATE_LIMIT_*` vía `setupFiles`.
- `tests/unit/`: `auth.middleware.test.js`, `rateLimit.middleware.test.js`, `proxy.middleware.test.js`, `health.middleware.test.js`, `tokenBucket.test.js`.
- `tests/e2e/gateway.e2e.test.js`: extremo a extremo.

## 7. Cómo usar

```bash
cd apps/api-gateway && npm run dev
curl http://localhost:3000/health/liveness
curl http://localhost:3000/health/readiness
curl -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"a@uajs.edu.co","password":"secreto123"}'
```
