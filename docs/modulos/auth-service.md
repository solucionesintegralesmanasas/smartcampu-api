# auth-service — Documentación detallada por carpeta

> Puerto 3001. Rol: registro, login, perfil, renovación, cierre y restablecimiento.
> Base: `/api/v1/auth`. Patrón `controller -> service -> repository` + Zod + BullMQ + Swagger.

## 1. Raíz `src/`

### `src/app.js`

- Fábrica `initApp()`: crea `express()`, aplica `expressLoader`, monta `setupSwagger`, retorna `app`.

### `src/server.js`

- Flujo: `await databaseLoader()` → `initApp()` → `new EmailConsumer()` → `listen(PORT)`.
- Maneja `EADDRINUSE`, `uncaughtException`, `unhandledRejection`, cierre con `emailConsumer.close()` y timeout 10s.

## 2. Carpeta `src/config/`

### `config/env.js`

- Zod estricto. Exporta `{ env }`.
- `PORT 3001`, `JWT_SECRET` mínimo 64, `JWT_EXPIRES_IN 15m`, `JWT_REFRESH_EXPIRES_IN 7d`, `JWT_REFRESH_SECRET` opcional con respaldo, `BCRYPT_ROUNDS 10-14 defecto 12`, `MYSQL_*` base `uajs_auth`, `REDIS_*`, `ELASTICSEARCH_*`, `EMAIL_QUEUE auth_emails`, `AUTH_EVENTS_INDEX uajs_auth_events`.

### `config/logger.js`

- Winston `Console` + `ElasticsearchTransport` prefijo `uajs-logs`, nivel `debug` salvo `production info`.

### `config/elasticsearch.js`

- Exporta `{ esClient, ensureAuthEventsIndex }`.
- Crea `uajs_auth_events` si no existe: `shards 2, replicas 1`, mapeo `strict` con `eventType, userId, email, ipAddress, userAgent, status, metadata, correlationId`.

### `config/queues.js`

- Exporta `{ createQueue(name), createWorker(name, processor) }` con conexión `REDIS_HOST/PORT`.

### `config/database/mysql.js`

- Exporta `createMySQLPool()` con `mysql2/promise`, `connectionLimit 10`, 5 reintentos cada 5s.

### `config/database/redis.js`

- Exporta `getRedisClient()` singleton con `commandTimeout 5000`, `maxRetriesPerRequest 3`.

## 3. Carpeta `src/core/`

### `core/loaders/express.loader.js`

- `helmet`, `cors`, `json/urlencoded`, `express-rate-limit 100/15min` solo `/api/`.
- Monta `authRoutes` en `/api/v1/auth`, `GET /healthz -> { status UP, service auth-service }`, manejador final `{ success false, message, errors }`.

### `core/loaders/database.loader.js`

- Solo `ensureAuthEventsIndex()` no bloqueante con `warn` si falla.

### `core/helpers/pagination.helper.js`

- Exporta `getPaginationMeta(page, limit, total)` → `{ page, limit, total, totalPages, hasNextPage, hasPrevPage }`. Actualmente huérfano.

### `core/exceptions/`

- `AppError.js`: base con `message`, `statusCode`.
- `ValidationError.js`: 400 con `errors []`.
- `UnauthorizedError.js`: 401. `ForbiddenError.js`: 403. `NotFoundError.js`: 404. `ConflictError.js`: 409.
- `index.js`: reexporta las 6.

## 4. Carpeta `src/modules/auth/` — 6 archivos

### `modules/auth/auth.routes.js`

- Cablea `AuthRepository`, `EmailProducer`, `AuthService`, `AuthController`.
- Ayudante `validate(schema)` con `safeParse(req.body)`.
- Rutas: `POST /register`, `POST /login`, `GET /me con requireAuth`, `POST /refresh`, `POST /logout`, `POST /password-reset`, `POST /password-reset/confirm`.

### `modules/auth/auth.controller.js`

- Clase `AuthController` fina con `register 201`, `login 200`, `refreshToken 200`, `me 200`, `logout 200`, `requestPasswordReset 200`, `confirmPasswordReset 200`. Todo `try/catch -> next`.

### `modules/auth/auth.service.js` — 283 líneas

- `register(dto)`: duplicado → `Conflict`, `bcrypt.hash`, crea con `uuid` y rol `STUDENT`, audita `user_registered`.
- `login(dto, req)`: busca por correo, `bcrypt.compare`, trae permisos, agrupa con `buildModulos`, firma `accessToken { sub, cedula, nombre, correo, rol, modulos }` y `refreshToken { sub }`, guarda hash `sha256`, audita `user_logged_in`. Retorna `{ accessToken, refreshToken, expiresIn, user }`.
- `buildModulos(permisos)`: agrupa `{ module, action }` por módulo ordenado.
- `getProfile(userId)`: perfil completo con tercero y estudiante o docente.
- `logout(dto)`: invalida refrescos, audita `user_logged_out`.
- `refreshToken(dto)`: verifica firma, reemite acceso, audita `token_refreshed`.
- `requestPasswordReset(email)`: mensaje genérico, token `randomBytes 32 hex`, hash `sha256`, expira 15 min, encola `send_reset_email`, audita.
- `confirmPasswordReset({ token, password })`: valida vigencia, actualiza hash, invalida refrescos, borra token.
- `logAuthEvent(eventType, metadata)`: `esClient.index` en `AUTH_EVENTS_INDEX` con `warn` si falla.

### `modules/auth/auth.repository.js` — 361 líneas

- Pool perezoso con `@uajs/database-client`.
- `findByEmail/findById`: solo `is_active 1` y `deleted_at NULL`, con `GROUP_CONCAT` de roles ordenados.
- `findPermissions(roles)`: une `role_permissions-roles-permissions`.
- `create(userData)`: transacción `persons + users + user_roles`.
- `updateRefreshToken/findByRefreshToken/invalidateRefreshTokens`: hash `sha256`, expiración desde JWT, `family_id UUID`.
- `create/find/deletePasswordResetToken/updatePassword`.
- `findFullProfile/hydrateFullProfile`: una consulta `users + persons + roles + academic persons + students + programs + teachers + faculties`, construye `{ id, uuid, email, roles, cedula, nombre, tercero, estudiante { programa }, docente { facultad } }`.

### `modules/auth/auth.validation.js`

- `registerSchema`: `email, password min8, firstName min2, middleName?, lastName min2, secondLastName?, documentTypeCode, documentNumber min5, phone?`.
- `loginSchema`: `email, password min1`.
- `refreshTokenSchema/logoutSchema`: `refreshToken min1`.
- `requestResetSchema`: `email`. `confirmResetSchema`: `token min1, password min8`.

### `modules/auth/auth.middleware.js`

- Exporta `requireAuth`: exige `Bearer`, `jwt.verify(JWT_SECRET)`, exige `sub`, inyecta `req.userId`.

## 5. Carpeta `src/jobs/`

### `jobs/producers/email.producer.js`

- Clase `EmailProducer` con `createQueue(EMAIL_QUEUE)`, `addJob(type, data)` con `attempts 3`, `backoff exponencial 1000`.

### `jobs/producers/auth.producer.js`

- Clase `AuthProducer` cola `auth_events`, `addAuthEvent(eventType, data)` → trabajo `log_auth_event`. Sin uso actual.

### `jobs/consumers/email.consumer.js`

- Clase `EmailConsumer` con `createWorker(EMAIL_QUEUE)`. Si `send_reset_email`: registra en ES `reset_email_sent` y retorna éxito. Instanciado en `server.js`.

## 6. Carpeta `src/docs/`

### `docs/swagger.config.js`

- Monta `swagger.yaml` en `/api-docs` con `swagger-ui-express`.

### `docs/swagger.yaml` — 152 líneas

- OpenAPI 3.0, `servers /api/v1`.
- Documenta `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` con `bearerAuth`. Faltan `refresh` y `password-reset`.

## 7. Carpeta `tests/`

- `tests/setup.js`: fija `JWT_SECRET 64+`, `BCRYPT 10`, `MYSQL/REDIS/ES localhost`, colas `test_*`.
- `tests/unit/auth.service.test.js`: unitarias.
- `tests/e2e/auth.e2e.test.js`: flujo completo.
- `tests/auth.http`: colección con `healthz, register, login, me, refresh, logout, password-reset`.

## 8. Cómo usar

```bash
cd apps/auth-service && npm run dev
curl -X POST http://localhost:3001/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"nuevo@uajs.edu.co","password":"Secreto123","firstName":"Ana","lastName":"Torres","documentTypeCode":"CC","documentNumber":"123456789"}'
curl http://localhost:3001/api/v1/auth/me -H "Authorization: Bearer <accessToken>"
```
