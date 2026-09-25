# SmartCampus API — Documentación de servicios funcionales

> Documentación de aplicación de lo que está funcionando correctamente en el monorepo.
> Alcance: solo los 5 servicios con código real. Los 7 restantes son andamios vacíos y se listan al final sin detalle de uso.
> Idioma: español. Fecha de verificación: 2026-09-24.

## 1. Visión general del proyecto

**Nombre:** `smartcampu-api` (UAJS Smart Campus).
**Tipo:** monorepo Turborepo con `npm workspaces` (`apps/*`, `packages/*`).
**Estilo:** Node >= 20, CommonJS (`"type": "commonjs"`), JavaScript plano sin TypeScript, alias en `jsconfig.json` (`@apps/*`, `@packages/*`, `@shared-types`, `@shared-utils`, `@database-client`).
**Patrón por servicio:** `controller -> service -> repository`, validación con Zod, cargadores `core/loaders/express + database`, documentación Swagger, colas BullMQ + Redis, índices Elasticsearch.

### 1.1 Estado real de los 12 microservicios (verificado en disco)

| Servicio               | Puerto                                    | Estado        | Evidencia                                                                                                                                                       |
| ---------------------- | ----------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api-gateway`          | 3000                                      | FUNCIONAL     | `src/app.js`, `server.js`, 7 middlewares, proxy a 11 rutas, 3 salud, tests unit + e2e                                                                           |
| `auth-service`         | 3001                                      | FUNCIONAL     | Módulo `auth` completo (6 ficheros), 7 endpoints, JWT + bcrypt, BullMQ correo, Swagger, tests                                                                   |
| `catalog-service`      | 3002 en `env.js` / 3003 en docs y `.http` | FUNCIONAL     | 4 módulos x 5 ficheros, 27 endpoints, Redis + ES, BullMQ, Swagger 276 líneas, sin `*.test.js`                                                                   |
| `university-service`   | 3004                                      | FUNCIONAL     | 6 módulos x 5 ficheros + `user-provisioning.service`, 36 lógicos / 72 montajes ES+EN, MySQL transaccional, BullMQ dual, Swagger 847 líneas, 15 tests unit + e2e |
| `storage-service`      | 3011                                      | FUNCIONAL     | Módulo `archivo` completo, 7 rutas, multer + uuid, BullMQ, Swagger, 7 tests unit + e2e                                                                          |
| `user-service`         | 3002 (reservado)                          | ANDAMIO VACÍO | Solo 8x `.gitkeep` en `src/`, 4x en `tests/`, sin `package.json`                                                                                                |
| `resource-service`     | 3005                                      | ANDAMIO VACÍO | Solo `.gitkeep`                                                                                                                                                 |
| `booking-service`      | 3006                                      | ANDAMIO VACÍO | Solo `.gitkeep`                                                                                                                                                 |
| `request-service`      | 3007                                      | ANDAMIO VACÍO | Solo `.gitkeep`                                                                                                                                                 |
| `event-service`        | 3008                                      | ANDAMIO VACÍO | Solo `.gitkeep`                                                                                                                                                 |
| `notification-service` | 3009                                      | ANDAMIO VACÍO | Solo `.gitkeep`                                                                                                                                                 |
| `pqrs-service`         | 3010                                      | ANDAMIO VACÍO | Solo `.gitkeep`                                                                                                                                                 |

> Nota: `AGENTS.md` marca `university-service` y `storage-service` como `Structure only`, pero en disco ya tienen implementación completa. `infrastructure/docker/docker-compose.yml` confirma que solo 5 servicios tienen imagen (gateway, auth, catalog, university, storage).

### 1.2 Arquitectura de despliegue

```text
Cliente
  |
  v
api-gateway :3000 (helmet, cors, requestId, auth JWT, rateLimit, proxy 30s)
  |-- /api/v1/auth          -> auth-service :3001
  |-- /api/v1/catalogos     -> catalog-service :3002/3003
  |-- /api/v1/universidad   -> university-service :3004
  |-- /api/v1/archivos      -> storage-service :3011
  |-- /api/v1/usuarios, /recursos, /reservas, /solicitudes, /eventos, /notificaciones, /pqrs -> 503 (andamios vacíos)
  |
  v
MySQL 8 (puerto externo 3307) + Redis 7 (6379) + Elasticsearch 8.12 (9200) + Kibana (5601)
```

Paquetes compartidos funcionales en `packages/`:

- `@uajs/shared-utils`: `logger` Winston, `crypto`, `response`, `constants`, `tokenBucket`.
- `@uajs/database-client`: pool MySQL con `opossum` + cliente Redis.
- `@uajs/shared-elasticsearch`: cliente ES, 13 índices (`uajs_users`, `uajs_resources`, etc.), `mappings/` 12 ficheros, `queries/`, `utils/`, plantillas e ILM.
- `@uajs/shared-types`: `user`, `domain`, `event`, `elasticsearch` (JS plano).

## 2. Infraestructura y arranque

Infra en `infrastructure/docker/docker-compose.yml` (432 líneas):

- `mysql:8.0` externo `3307`, `redis:7-alpine` `6379`, `elasticsearch:8.12.0` `9200`, `kibana` `5601`.
- Solo levanta los 5 servicios con código. Comentario explícito de que `booking, event, notification, pqrs, request, resource, user` están vacíos.

Comandos raíz:

```bash
npm run dev            # arranca los 12 servicios vía Turborepo (7 fallan por ser andamios)
npm run build          # construye paquetes primero
npm run test           # todos los tests
npm run docker:up      # MySQL + Redis + ES + Kibana
npm run docker:down
npm run es:status
npm run validate:env
```

Un servicio:

```bash
cd apps/auth-service && npm run dev
cd apps/auth-service && npm run test:unit
cd apps/auth-service && npm run test:e2e
```

Variables clave (ver `.env.example` raíz y por app):

- `JWT_SECRET` mínimo 32 caracteres, `CORS_ALLOWED_ORIGINS`, `SERVICE_AUTH_TOKEN` para inter-servicios.
- Gateway: `PORT`, `NODE_ENV`, `RATE_LIMIT_*`, 11 `SERVICE_*_URL`.
- Auth: `MYSQL_*`, `REDIS_*`, `ELASTICSEARCH_*`, colas `AUTH_QUEUE`, `EMAIL_QUEUE`.
- Catalog: `CATALOG_QUEUE=catalog_events`, `CATALOG_INDEX=uajs_catalogs`, `CATALOG_CACHE_TTL=3600`.
- University: `MYSQL_DATABASE=uajs_academic`, `UNIVERSITY_QUEUE=university_events`, `UNIVERSITY_INDEX=uajs_university`.
- Storage: `STORAGE_QUEUE`, `STORAGE_INDEX`, límites multer.

## 3. api-gateway — puerto 3000 — FUNCIONAL

**Rol:** borde de seguridad, enrutado y observabilidad. Sin lógica de negocio ni base de datos propia.

**Archivos:** `src/app.js` (helmet + cors + `express.json 10mb` + requestId + elasticsearch + health + auth + rateLimit + proxy + 404 + errorHandler), `src/server.js` (`app.listen`, cierre ordenado con `tokenBucket.stop()`, timeout 10s), `src/routes/health.routes.js`, `src/routes/index.routes.js` (vacío intencional, el proxy se inyecta directo), `src/middleware/` 7 reales, `src/core/rateLimiter/tokenBucket.js`, `src/config/env.js, logger.js, elasticsearch.js`.

### 3.1 Endpoints de salud (sin prefijo global)

| Método | Ruta                | Auth | Descripción                                                                                                                                                     |
| ------ | ------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health/liveness`  | No   | Siempre `200 UP` con `pid` y `timestamp`                                                                                                                        |
| GET    | `/health/readiness` | No   | Sondeo con caché 12s, `opossum`, timeout 2s a `mysql_auth, redis_perimeter, elasticsearch, disk_space`. `503` si MySQL cae, `200 DEGRADED` si Redis o ES fallan |
| GET    | `/health/metrics`   | No   | Formato Prometheus `api_gateway_up`, `api_gateway_dependency_up/latency_ms`                                                                                     |

Ejemplo:

```bash
curl http://localhost:3000/health/liveness
curl http://localhost:3000/health/readiness
curl http://localhost:3000/health/metrics
```

### 3.2 Tabla de proxy (todo método, 30s timeout)

| Prefijo público          | Destino (`SERVICE_*_URL`)  | Estado destino            |
| ------------------------ | -------------------------- | ------------------------- |
| `/api/v1/auth`           | `SERVICE_AUTH_URL`         | Funcional                 |
| `/api/v1/catalogos`      | `SERVICE_CATALOG_URL`      | Funcional (ver sección 5) |
| `/api/v1/universidad`    | `SERVICE_UNIVERSITY_URL`   | Funcional                 |
| `/api/v1/archivos`       | `SERVICE_STORAGE_URL`      | Funcional                 |
| `/api/v1/usuarios`       | `SERVICE_USER_URL`         | Andamio -> `503`          |
| `/api/v1/recursos`       | `SERVICE_RESOURCE_URL`     | Andamio -> `503`          |
| `/api/v1/reservas`       | `SERVICE_BOOKING_URL`      | Andamio -> `503`          |
| `/api/v1/solicitudes`    | `SERVICE_REQUEST_URL`      | Andamio -> `503`          |
| `/api/v1/eventos`        | `SERVICE_EVENT_URL`        | Andamio -> `503`          |
| `/api/v1/notificaciones` | `SERVICE_NOTIFICATION_URL` | Andamio -> `503`          |
| `/api/v1/pqrs`           | `SERVICE_PQRS_URL`         | Andamio -> `503`          |

El proxy reenvía `body JSON` consumido por `express.json()`, inyecta `X-User-Id, X-User-Roles, X-Request-Id` y mapea errores a `502/503/504`.

### 3.3 Autenticación en el borde

Rutas públicas por `startsWith`: `/health`, `/api/v1/auth/login`, `/register`, `/refresh`, `/password-reset`, `/password-reset/confirm` más compatibilidad `/reset-password` y `/reset-password/confirm`. Resto exige `Bearer JWT`, acepta `roles[]` o `rol` singular, inyecta `req.user={id, roles}`. `401` si falta o es inválido.

Rate-limit por `user:id` o `ip` con cabeceras `X-RateLimit-*` y `Retry-After 429`. Registro asíncrono a índice diario `uajs_gateway_logs-YYYY-MM-DD`.

Uso vía gateway (ejemplos):

```bash
curl -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"a@uajs.edu.co","password":"secreto123"}'
curl http://localhost:3000/api/v1/catalogos/api/v1/catalog/cities -H "Authorization: Bearer <accessToken>"
```

> Brechas conocidas: `index.routes.js` vacío, sin Swagger ni `/api-docs`, sin BullMQ, `health.middleware.js` lee `process.env` directo con valores distintos (`uajs_smart_campus`, `uajs206**`) y `SERVICE_VERSION=v2.1.4` no coincide con `package.json 2.1.0`.

**Arranque y pruebas:**

```bash
cd apps/api-gateway && npm run dev
npm run test  # jest --runInBand: 5 unit (auth, proxy, health, rateLimit, tokenBucket) + e2e/gateway.e2e.test.js
```

Dependencias: `express, helmet, cors, http-proxy-middleware, jsonwebtoken, opossum, zod, compression, dotenv, express-async-errors`.

## 4. auth-service — puerto 3001 — FUNCIONAL

**Rol:** registro, inicio de sesión, perfiles, renovación, cierre y restablecimiento de contraseña.

**Estructura:** `src/app.js` (fábrica `initApp`), `src/server.js` (arranque async, `databaseLoader`, `EmailConsumer`, manejo `uncaughtException/unhandledRejection`, `EADDRINUSE`), `src/modules/auth/auth.{routes,controller,service,repository,validation,middleware}.js`, `src/core/exceptions/` 6 clases, `loaders/express|database`, `helpers/pagination.helper.js` (huérfano), `src/config/env.js, logger.js, elasticsearch.js, queues.js, database/mysql.js, redis.js`, `src/docs/swagger.yaml + swagger.config.js`, `jobs/producers/auth|email.producer.js + jobs/consumers/email.consumer.js`.

Base: `/api/v1/auth` definida en `express.loader.js`.

### 4.1 Endpoints

| Método | Ruta                                  | Auth                     | Cuerpo validado (Zod)                                                                                                                         | Respuesta                                                                                                                                                                                |
| ------ | ------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/register`               | No                       | `email(email), password(min8), firstName(min2), middleName?, lastName(min2), secondLastName?, documentTypeCode, documentNumber(min5), phone?` | `201 {success:true,data}` transacción `persons+users+user_roles` rol `STUDENT`                                                                                                           |
| POST   | `/api/v1/auth/login`                  | No                       | `email, password`                                                                                                                             | `200 {accessToken, refreshToken, expiresIn, user{id,uuid,email,roles,cedula,nombre,modulos}}` con `bcrypt.compare`, JWT `sub, cedula, nombre, correo, rol, modulos`, permisos por módulo |
| GET    | `/api/v1/auth/me`                     | Sí `requireAuth Bearer`  | —                                                                                                                                             | Perfil completo `usuario+roles+modulos+tercero+estudiante/programa o docente/facultad`                                                                                                   |
| POST   | `/api/v1/auth/refresh`                | No                       | `refreshToken`                                                                                                                                | Reemite `accessToken` tras verificar firma                                                                                                                                               |
| POST   | `/api/v1/auth/logout`                 | No (con token en cuerpo) | `refreshToken`                                                                                                                                | Invalida todos los `refresh_tokens`                                                                                                                                                      |
| POST   | `/api/v1/auth/password-reset`         | No                       | `email`                                                                                                                                       | Respuesta genérica anti-enumeración + encola `send_reset_email` (token aleatorio 15 min, hash sha256)                                                                                    |
| POST   | `/api/v1/auth/password-reset/confirm` | No                       | `token, password(min8)`                                                                                                                       | Actualiza `password_hash`, invalida refrescos, borra token                                                                                                                               |
| GET    | `/healthz`                            | No                       | —                                                                                                                                             | `{status:UP, service:auth-service}`                                                                                                                                                      |
| GET    | `/api-docs`                           | No                       | —                                                                                                                                             | Swagger UI (solo documenta `register, login, logout, me`)                                                                                                                                |

Ejemplos:

```bash
curl -X POST http://localhost:3001/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"nuevo@uajs.edu.co","password":"Secreto123","firstName":"Ana","lastName":"Torres","documentTypeCode":"CC","documentNumber":"123456789"}'
curl -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"nuevo@uajs.edu.co","password":"Secreto123"}'
curl http://localhost:3001/api/v1/auth/me -H "Authorization: Bearer <accessToken>"
curl -X POST http://localhost:3001/api/v1/auth/refresh -H "Content-Type: application/json" -d '{"refreshToken":"<refresh>"}'
curl -X POST http://localhost:3001/api/v1/auth/password-reset -H "Content-Type: application/json" -d '{"email":"nuevo@uajs.edu.co"}'
```

Persistencia real: `uajs_auth(users, persons, roles, permissions, refresh_tokens, password_reset_tokens)` y lectura `uajs_academic(persons, students, programs, teachers, faculties)`. Auditoría a `uajs_auth_events` en cada evento, índice creado al arranque.

Colas: `AuthProducer(auth_events)` sin consumidor (eventos huérfanos), `EmailProducer(EMAIL_QUEUE)` + `EmailConsumer` activo pero simulado (solo registra `reset_email_sent` en ES, no envía SMTP).

> Brechas: Swagger sin `refresh, password-reset`, `database/mysql.js` con reintentos sin uso (repositorio usa paquete compartido), sin `requestId`, sin bloqueo por intentos, sin verificación de correo, `refresh` no rota, `logout` invalida todos los dispositivos.

**Arranque y pruebas:**

```bash
cd apps/auth-service && npm run dev
npm run test:unit  # tests/unit/auth.service.test.js
npm run test:e2e   # tests/e2e/auth.e2e.test.js
# manual: tests/auth.http
```

## 5. catalog-service — puerto 3002/3003 — FUNCIONAL

**Rol:** catálogos base (departamentos, ciudades, sedes, tipos de documento) con CRUD, caché Redis y búsqueda ES.

**Advertencia de puerto:** `src/config/env.js` define `PORT` por defecto `3002`, pero `AGENTS.md` dice `3003` y `catalog-service.http` usa `http://localhost:3003`. Documentar y unificar antes de exponer vía gateway.

**Estructura:** `src/app.js`, `src/server.js` (72 líneas, `databaseLoader` solo asegura índice ES, `CatalogConsumer`, cierre 10s), `src/config/env.js, logger.js, elasticsearch.js, queues.js` (sin `database/`), `core/exceptions/` 4 clases, `loaders/express|database`, `helpers/pagination.helper.js`, `modules/{department,city,campus,document-type}/*.controller|service|repository|validation|routes.js`, `jobs/producers/catalog.producer.js + consumers/catalog.consumer.js`, `docs/swagger.yaml 276 líneas + swagger.config.js`, `tests/setup.js + catalog-service.http 187 líneas` (sin `*.test.js`).

Base en `express.loader.js`: `/api/v1/catalog/*` + `GET /api/v1/catalog/health -> {status:UP, service:catalog-service}`.

### 5.1 Endpoints (27 totales)

Patrón por router: `POST / | GET / | GET /search?search= | GET /:id | PUT /:id | DELETE /:id`, más extras en ciudad y sede.

| Módulo         | Base                             | Extras                | Total |
| -------------- | -------------------------------- | --------------------- | ----- |
| departments    | `/api/v1/catalog/departments`    | —                     | 6     |
| document-types | `/api/v1/catalog/document-types` | —                     | 6     |
| cities         | `/api/v1/catalog/cities`         | `GET /state/:stateId` | 7     |
| campuses       | `/api/v1/catalog/campuses`       | `GET /city/:cityId`   | 7     |
| salud          | `/api/v1/catalog/health`         | —                     | 1     |

Detalle (ejemplo ciudades, idéntico para los otros con su base):

| Método | Ruta                                    | Descripción                                                                    |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| POST   | `/api/v1/catalog/cities`                | Crea, valida `createSchema`, `409` si conflicto                                |
| GET    | `/api/v1/catalog/cities?page=&limit=`   | Lista paginada `{success:true,data,pagination}`, caché `cities:all:page:limit` |
| GET    | `/api/v1/catalog/cities/search?search=` | Búsqueda texto                                                                 |
| GET    | `/api/v1/catalog/cities/state/:stateId` | Filtra por departamento                                                        |
| GET    | `/api/v1/catalog/cities/:id`            | Detalle, `404` si no existe                                                    |
| PUT    | `/api/v1/catalog/cities/:id`            | Actualiza `updateSchema`                                                       |
| DELETE | `/api/v1/catalog/cities/:id`            | Elimina                                                                        |

Ejemplos:

```bash
curl http://localhost:3003/api/v1/catalog/health
curl "http://localhost:3003/api/v1/catalog/cities?page=1&limit=10"
curl "http://localhost:3003/api/v1/catalog/cities/search?search=bog"
curl -X POST http://localhost:3003/api/v1/catalog/departments -H "Content-Type: application/json" -d '{"nombre":"Cundinamarca","codigo":"CUN"}'
curl http://localhost:3003/api/v1/catalog/campuses/city/1
```

Persistencia: MySQL declarado en env pero sin loader dedicado, Redis vía `createRedisClient` al vuelo en `express.loader`, ES `uajs_catalogs` (`shards:2, replicas:1, dynamic:strict`, analizador `spanish`) más índice `${CATALOG_INDEX}_events` vía BullMQ (`addCatalogEvent`, job `log_catalog_event`, `attempts:3 backoff:exponential`).

Rate-limit `200/15min` sobre `/api/`.

> Brechas: 0 `*.test.js` (jest espera `**/tests/**/*.test.js`), sin umbrales de cobertura, sin `database/mysql.js|redis.js` dedicados, validación solo `body` sin `querySchema`.

**Arranque:**

```bash
cd apps/catalog-service && npm run dev  # revisar PORT real en .env
# colección manual: tests/catalog-service.http
```

## 6. university-service — puerto 3004 — FUNCIONAL (más maduro)

**Rol:** núcleo académico y aprovisionamiento de usuarios (estudiantes y docentes con correo institucional).

**Estructura:** `src/app.js`, `src/server.js` (82 líneas, `UniversityConsumer` en `try/catch` no fatal), `src/config/env.js (PORT 3004, MYSQL_DATABASE uajs_academic), logger.js, elasticsearch.js, queues.js, database/mysql.js (pool limit 10 + circuit breaker), database/redis.js`, `core/exceptions/ 5 ficheros, loaders/express|database (asegura índice ES + pool.ping MySQL), helpers/pagination.helper.js, services/user-provisioning.service.js 151 líneas`, 6 módulos x 5 ficheros, `jobs/producers/university.producer.js (48 líneas) + consumers/university.consumer.js (67 líneas)`, `docs/swagger.yaml 847 líneas + swagger.config.js + README.md 172 líneas`, `tests/setup.js + university-service.http 307 líneas + unit/ 15 ficheros + e2e/university.e2e.test.js` (`integration/fixtures` solo `.gitkeep`).

Servicio transversal `provisionUser({person, roleName:STUDENT|TEACHER, customPassword}, conn)`: genera correo `estudiantes.uajs.edu.co / docentes.uajs.edu.co`, `hashPassword`, crea en `uajs_auth.users` y asigna rol. Usado por `estudiante` y `docente`.

### 6.1 Endpoints (36 lógicos, 72 montajes ES+EN + 3 salud)

Rutas español (gateway) y alias inglés (misma lógica):

- Español: `/api/v1/universidad/empresas, /terceros, /facultades, /programas, /estudiantes, /docentes`
- Inglés: `/api/v1/university/companies, /persons, /faculties, /programs, /students, /teachers`
- Salud: `GET /api/v1/universidad/health, GET /api/v1/university/health, GET /healthz -> {status:UP, service:university-service, environment}` + `helmet` + `rateLimit 200/15min`.

Por cada uno de los 6 routers (ejemplo facultades):

| Método | Ruta ejemplo                                                    | Validación          | Descripción                |
| ------ | --------------------------------------------------------------- | ------------------- | -------------------------- |
| GET    | `/api/v1/universidad/facultades/search?search=`                 | —                   | Búsqueda                   |
| GET    | `/api/v1/universidad/facultades?page=&limit=&search=&campusId=` | `querySchema`       | Lista paginada con filtros |
| POST   | `/api/v1/universidad/facultades`                                | `createSchema body` | Crea, `201`, `400/409`     |
| GET    | `/api/v1/universidad/facultades/:id`                            | —                   | Detalle                    |
| PUT    | `/api/v1/universidad/facultades/:id`                            | `updateSchema body` | Actualiza                  |
| DELETE | `/api/v1/universidad/facultades/:id`                            | —                   | Elimina                    |

Lo mismo para `empresas/companies, terceros/persons, programas/programs, estudiantes/students, docentes/teachers`. `estudiante.service.js` (300 líneas) valida `personaId/programaId`, unicidad `codigoEstudiante/personaId`, aprovisiona `userUuid` rol `STUDENT` en transacción, indexa y invalida caché.

Ejemplos:

```bash
curl http://localhost:3004/api/v1/universidad/health
curl "http://localhost:3004/api/v1/universidad/facultades?page=1&limit=10"
curl -X POST http://localhost:3004/api/v1/universidad/empresas -H "Content-Type: application/json" -d '{"nombre":"Empresa Convenio","nit":"900123456"}'
curl -X POST http://localhost:3004/api/v1/universidad/estudiantes -H "Content-Type: application/json" -d '{"personaId":1,"programaId":2,"codigoEstudiante":"2026-001"}'
curl http://localhost:3004/api/v1/university/students -H "Authorization: Bearer <token>"
```

Persistencia: MySQL `uajs_academic` transaccional + `uajs_auth` (provisioning), ES `uajs_university`, Redis. Jobs: `addUniversityEvent` job `log_university_event` + `publishEntitySync` job `sync_university_entity` (`removeOnComplete:100`); consumidor indexa en `${UNIVERSITY_INDEX}_events` y hace `index/delete id=entityType_id` en `uajs_university`.

Swagger: `openapi:3.0.3`, `servers localhost:3004 + gateway:3000`, `components/schemas/CreateEmpresaDto`, códigos `201/400/409`.

**Arranque y pruebas:**

```bash
cd apps/university-service && npm run dev
npm run test:unit
npm run test:e2e
npm run test  # con thresholds branches:70 functions:80 lines:80 statements:80
# manual: tests/university-service.http (@serviceUrl=:3004 @gatewayUrl=:3000)
```

## 7. storage-service — puerto 3011 — FUNCIONAL

**Rol:** gestión de archivos y metadatos con subida `multipart`, ES y colas.

**Estructura:** `src/app.js` (`initApp` + `expressLoader` + `setupSwagger`), `src/server.js`, `src/config/env.js, logger.js, elasticsearch.js, queues.js, database/mysql.js, database/redis.js`, `core/exceptions/ 5 ficheros, loaders/express|database, helpers/pagination.helper.js`, `modules/archivo/archivo.{controller,service 173 líneas, repository, validation Zod, routes}.js`, `jobs/producers/storage.producer.js + consumers/storage.consumer.js` (BullMQ), `docs/swagger.yaml + swagger.config.js`, `tests/setup.js + unit/ 7 ficheros (service, controller, repository, validation, app.routes, config, jobs) + e2e/storage.e2e.test.js`.

Base en `express.loader.js`: `/api/v1/storage` + `GET /healthz -> {status:UP, service:storage-service}`. `helmet` + `rateLimit 100/15min`.

### 7.1 Endpoints

| Método | Ruta                             | Validación                                                                | Descripción                                              |
| ------ | -------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| POST   | `/api/v1/storage/upload`         | `multer.memoryStorage upload.single('file')` + `createFileMetadataSchema` | Sube archivo, genera `uuidv4`, indexa en `STORAGE_INDEX` |
| GET    | `/api/v1/storage/search?search=` | `searchFilesQuerySchema`                                                  | Búsqueda por metadatos                                   |
| GET    | `/api/v1/storage?page=&limit=`   | `listFilesQuerySchema`                                                    | Lista paginada                                           |
| GET    | `/api/v1/storage/:id`            | —                                                                         | Detalle por id numérico                                  |
| GET    | `/api/v1/storage/uuid/:uuid`     | —                                                                         | Detalle por uuid                                         |
| PATCH  | `/api/v1/storage/:id`            | `updateFileSchema`                                                        | Actualiza metadatos                                      |
| DELETE | `/api/v1/storage/:id`            | —                                                                         | Elimina                                                  |
| GET    | `/healthz`                       | —                                                                         | Salud                                                    |

Ejemplos:

```bash
curl http://localhost:3011/healthz
curl -X POST http://localhost:3011/api/v1/storage/upload -F "file=@/tmp/doc.pdf" -F "descripcion=acta" -F "categoria=academico"
curl "http://localhost:3011/api/v1/storage?page=1&limit=10"
curl "http://localhost:3011/api/v1/storage/search?search=acta"
curl http://localhost:3011/api/v1/storage/uuid/<uuid>
curl -X PATCH http://localhost:3011/api/v1/storage/1 -H "Content-Type: application/json" -d '{"descripcion":"acta actualizada"}'
```

Vía gateway: prefijo `/api/v1/archivos` -> `SERVICE_STORAGE_URL`.

**Arranque y pruebas:**

```bash
cd apps/storage-service && npm run dev
npm run test:unit
npm run test:e2e
```

Deps: `express, multer, uuid, bullmq, mysql2, ioredis, zod, @uajs/* file:`.

## 8. Servicios no funcionales (sin documentación de uso)

No generan documentación de aplicación porque no tienen código ejecutable. Todos con raíz solo `src/ + tests/` y dentro solo `.gitkeep`:

- `user-service` (:3002 reservado): sin `package.json, Dockerfile, app.js, server.js, modules/usuario`.
- `resource-service` (:3005), `booking-service` (:3006), `request-service` (:3007), `event-service` (:3008), `notification-service` (:3009), `pqrs-service` (:3010): mismo estado.

El gateway los proxea pero responden `503 SERVICE_UNAVAILABLE` (`ECONNREFUSED/ENOTFOUND`). `docs/structure.md` (1029 líneas) describe su diseño futuro, no su uso actual.

## 9. Cómo verificar que lo funcional opera

1. Infra: `npm run docker:up`, luego `npm run es:status`.
2. Arrancar en orden: `auth :3001`, `catalog :3002/3003`, `university :3004`, `storage :3011`, al final `gateway :3000` (o `npm run dev` y verificar que 7 fallan por andamios).
3. Salud directa:
   `curl localhost:3001/healthz`, `curl localhost:3003/api/v1/catalog/health`, `curl localhost:3004/api/v1/universidad/health`, `curl localhost:3011/healthz`, `curl localhost:3000/health/readiness`.
4. Flujo extremo vía gateway: `register -> login -> me` con `Authorization: Bearer`, luego `GET /api/v1/catalogos/api/v1/catalog/cities`, `GET /api/v1/universidad/api/v1/universidad/facultades`, `POST /api/v1/archivos/api/v1/storage/upload`.
5. Colecciones `.http`: `apps/auth-service/tests/auth.http`, `apps/catalog-service/tests/catalog-service.http`, `apps/university-service/tests/university-service.http`.
6. Tests: `npm run test` raíz o `test:unit / test:e2e` por app (catalog sin tests, university con thresholds 70/80/80/80, gateway 5 unit + e2e, auth unit + e2e, storage 7 unit + e2e).

## 10. Brechas y pendientes antes de producción

- Unificar puerto catalog (3002 vs 3003) en `env.js`, `AGENTS.md`, `.http` y `SERVICE_CATALOG_URL` del gateway.
- Completar `swagger.yaml` de auth (`refresh, password-reset`), crear Swagger en gateway.
- `EmailConsumer` simulado: integrar SMTP real; `AuthProducer(auth_events)` sin consumidor.
- Auth: rotar `refreshToken`, `logout` por dispositivo, bloqueo por intentos, verificación de correo, `requestId`.
- Catalog: crear `config/database/mysql.js|redis.js`, `querySchema`, batería Jest, umbrales de cobertura.
- Gateway: rellenar o eliminar `index.routes.js`, usar `config/env.js` en `health.middleware.js`, alinear `SERVICE_VERSION`.
- Implementar los 7 andamios vacíos o retirar sus entradas del `SERVICE_MAP` y `docker-compose` para no exponer `503`.
- Alinear `AGENTS.md` (tabla de estados) con la realidad verificada en disco.
