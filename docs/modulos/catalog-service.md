# catalog-service — Documentación detallada por carpeta

> Puerto 3002 en `env.js` / 3003 en `.env.example` y `.http`. Rol: catálogos base con CRUD, caché Redis y búsqueda ES.
> Base `/api/v1/catalog/*`. 4 módulos x 5 archivos. Sin `config/database/`, sin `*.test.js`.

## 1. Raíz `src/`

### `src/app.js` — 13 líneas

- `initApp()`: crea `express()`, aplica `expressLoader`, monta `setupSwagger`, retorna `app`.

### `src/server.js` — 72 líneas

- `await databaseLoader()` solo ES, `initApp()`, `new CatalogConsumer()`, `listen(PORT)` con `EADDRINUSE`, cierre `SIGTERM/SIGINT` con `catalogConsumer.close()` y 10s.

## 2. Carpeta `src/config/`

### `config/env.js` — 25 líneas

- `NODE_ENV`, `PORT` defecto 3002, `MYSQL_*` base `uajs_catalog`, `REDIS_*`, `ELASTICSEARCH_*`, `CATALOG_QUEUE catalog_events`, `CATALOG_INDEX uajs_catalogs`, `CATALOG_CACHE_TTL 3600`.

### `config/logger.js` — 29 líneas

- Winston `timestamp json`, `Console` + `ElasticsearchTransport` prefijo `uajs-logs`.

### `config/elasticsearch.js` — 55 líneas

- `esClient` y `ensureCatalogIndex()`: crea `uajs_catalogs` con `shards 2, replicas 1`, `dynamic strict`, campos `type, id, nombre spanish, codigo, estado, parent, location geo_point, createdAt, updatedAt`. No bloqueante.
- Nota: los servicios usan índices literales `departments, cities, campuses, document-types`, no este índice.

### `config/queues.js` — 14 líneas

- `createQueue(name)`, `createWorker(name, processor)` con `REDIS_HOST/PORT`.

## 3. Carpeta `src/core/`

### `core/exceptions/`

- `AppError.js`: base con `statusCode`. `NotFoundError.js`: 404. `ConflictError.js`: 409. `ValidationError.js`: 400 con `errors`. `index.js`: reexporta.

### `core/loaders/express.loader.js` — 69 líneas

- Crea `app.locals.redisClient` con `createRedisClient`.
- `cors`, `json`, `urlencoded`, `express-rate-limit 200/15min` en `/api/`.
- Monta `/api/v1/catalog/departments`, `/cities`, `/campuses`, `/document-types`.
- `GET /api/v1/catalog/health -> { status UP, service catalog-service }`.
- Error final `{ success false, message, errors }`.

### `core/loaders/database.loader.js` — 13 líneas

- Solo `ensureCatalogIndex()` con `warn` no fatal. Sin MySQL ni Redis.

### `core/helpers/pagination.helper.js` — 26 líneas

- `paginationHelper(page 1, limit 20)`: sanea `1..100`, calcula `offset`.
- `paginateResult` y `getPaginationMeta`: `{ data, pagination { page, limit, total, totalPages } }`.

## 4. Carpeta `src/modules/department/`

### `department.controller.js` — 66 líneas

- `create 201`, `findAll 200 { data, pagination }` con `page 1 limit 10`, `findById 200`, `update 200`, `delete 200 { message }`, `search 200`.

### `department.service.js` — 169 líneas

- `ES_INDEX departments`.
- Caché: `departments:all:page:limit` y `departments:id` con `CATALOG_CACHE_TTL`. `invalidateCache` solo borra listados, no individuales.
- ES no bloqueante: `index` en crear/actualizar con `{ id, uuid, name, daneCode, active, createdAt, updatedAt }`, `delete` en borrar, `search` con `multi_match [name, daneCode] fuzziness AUTO`.
- `create` verifica `findByName 409`, `update` verifica existencia 404 y duplicado, `delete` borrado lógico + ES + caché.

### `department.repository.js` — 102 líneas

- Tabla `departments`, pool perezoso `connectionLimit 10`.
- `create { name, daneCode }`, `findAll` con `COUNT` + `SELECT ... WHERE is_active 1 ORDER BY id DESC LIMIT OFFSET`, `findById`, `update` sobrescritura total, `delete` lógico `is_active 0`, `findByName`, `countAll`.

### `department.validation.js` — 13 líneas

- `createSchema`: `name min2, daneCode max10?`. `updateSchema`: todo opcional.

### `department.routes.js` — 41 líneas

- Singleton `Repository`, `Service/Controller` perezosos con `req.app.locals.redisClient`.
- `validate(schema)` con `safeParse(req.body)`.
- `POST /`, `GET /`, `GET /search` antes de `/:id`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

## 5. Carpeta `src/modules/city/`

### `city.controller.js` — 79 líneas

- Igual que departamento más `findByStateId(req.params.stateId)`.

### `city.service.js` — 186 líneas

- `ES_INDEX cities`, documento con `stateId`.
- Caché extra `cities:state:stateId`. Mismo defecto de invalidación.
- `search` por `[name, daneCode]`. Duplicados solo por `name`.

### `city.repository.js` — 109 líneas

- Tabla `cities` con `state_id AS stateId`.
- `create { stateId, name, daneCode }`, `findByStateId WHERE state_id AND is_active 1 ORDER BY name`, `update` requiere los 3 campos.

### `city.validation.js` — 15 líneas

- `create`: `stateId int positivo, name min2, daneCode max10?`. `update`: todo opcional.

### `city.routes.js` — 42 líneas

- `POST /`, `GET /`, `GET /search`, `GET /state/:stateId`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

## 6. Carpeta `src/modules/campus/`

### `campus.controller.js` — 79 líneas

- `create, findAll, findById, findByCityId, update, delete, search`.

### `campus.service.js` — 188 líneas

- `ES_INDEX campuses`, documento `{ name, address, phone, cityId }`.
- Caché `campuses:all`, `campuses:id`, `campuses:city:cityId`. Búsqueda `[name, address, phone]`.

### `campus.repository.js` — 111 líneas

- Tabla legada `sedes`: `nombre AS name, direccion AS address, telefono AS phone, id_ciudad AS cityId, activo AS active, id_sede AS id`.
- `create { cityId, name, address, phone }`, `findByCityId`, `update` total, `delete` lógico.

### `campus.validation.js` — 17 líneas

- `create`: `cityId int positivo, name min2, address?, phone max20?`. `update` opcional.

### `campus.routes.js` — 42 líneas

- `POST /`, `GET /`, `GET /search`, `GET /city/:cityId`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

## 7. Carpeta `src/modules/document-type/`

### `document-type.controller.js` — 70 líneas

- 6 métodos estándar sin filtro por padre.

### `document-type.service.js` — 187 líneas

- `ES_INDEX document-types`, claves `documentTypes:all`, `documentTypes:id`.
- Documento `{ name, code, requiresCheckDigit }`. Búsqueda `[name, code]`. Doble unicidad `name` y `code`.

### `document-type.repository.js` — 127 líneas

- Tabla `document_types`, único con `update` parcial real que arma `SET` dinámico.
- `create { name, code, requiresCheckDigit }`, `findByName`, `findByCode`.

### `document-type.validation.js` — 15 líneas

- `create`: `name min2, code max10?, requiresCheckDigit boolean?`. `update` opcional.

### `document-type.routes.js` — 44 líneas

- `POST /`, `GET /`, `GET /search`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

## 8. Carpeta `src/jobs/`

### `jobs/producers/catalog.producer.js` — 24 líneas

- `CatalogProducer` cola `catalog_events`, `addCatalogEvent(eventType, data)` → `log_catalog_event` con `attempts 3`. Sin uso actual.

### `jobs/consumers/catalog.consumer.js` — 34 líneas

- `CatalogConsumer` con `createWorker(CATALOG_QUEUE)`. Si `log_catalog_event`: indexa en `uajs_catalogs_events` con `timestamp` y `service catalog-service`. `close()` para apagado.

## 9. Carpeta `src/docs/`

### `docs/swagger.config.js` — 17 líneas

- Monta en `/api/docs` con `explorer true`.

### `docs/swagger.yaml` — 276 líneas

- OpenAPI 3.0.0, `servers /api/v1`.
- Documenta `/catalog/health`, `/departments`, `/cities` con `/state/{stateId}`, `/campuses` con `/city/{cityId}`, `/document-types` con CRUD y `search`. Solo `200/201`, sin errores ni auth.

## 10. Carpeta `tests/`

- `tests/setup.js`: mock `logger` y `env` con `PORT 3002`, `CATALOG_QUEUE test_catalog`.
- `tests/catalog-service.http` — 187 líneas: colección con `@base localhost:3003`, health y CRUD de las 4 entidades.
- Sin `*.test.js`. `jest.config.js` espera `**/tests/**/*.test.js`, cobertura `src/**/*.js` sin `server.js`, sin umbrales.

## 11. Cómo usar

```bash
cd apps/catalog-service && npm run dev
curl http://localhost:3003/api/v1/catalog/health
curl "http://localhost:3003/api/v1/catalog/cities?page=1&limit=10"
curl "http://localhost:3003/api/v1/catalog/cities/state/1"
```
