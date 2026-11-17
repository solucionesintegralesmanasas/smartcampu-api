# storage-service — Documentación detallada por carpeta

> Puerto 3011. Rol: archivos y metadatos con `multipart`, MySQL, ES y BullMQ.
> Base `/api/v1/storage`. Módulo único `archivo` con 5 archivos.

## 1. Raíz `src/`

### `src/app.js` — 17 líneas

- `initApp()`: crea `express()`, aplica `expressLoader`, monta `setupSwagger`, retorna app para pruebas.

### `src/server.js` — 72 líneas

- `uncaughtException/unhandledRejection -> exit 1`.
- `startServer`: `databaseLoader()` → app → `new StorageConsumer()` → `listen(PORT)` con `EADDRINUSE`.
- Cierre `SIGTERM/SIGINT` con servidor HTTP y consumidor, 10s.

## 2. Carpeta `src/config/` — 6 archivos

### `config/env.js` — 28 líneas

- `PORT 3011`, `JWT_SECRET?` mínimo 64, `MYSQL_DATABASE uajs_storage`, `REDIS`, `ES`, `STORAGE_QUEUE storage_jobs`, `STORAGE_INDEX uajs_storage`, `MAX_FILE_SIZE 10485760 10MB`, `UPLOAD_DIR /uploads`.

### `config/logger.js` — 32 líneas

- Winston `json + timestamp`, `Console` + `winston-elasticsearch` índice `uajs-logs`, `debug` salvo `production info`.

### `config/elasticsearch.js` — 55 líneas

- `ensureStorageIndex()`: crea `uajs_storage` con 1 fragmento 1 réplica, `dynamic strict`, 16 campos: `id, uuid, nombre_original texto+keyword, nombre_sistema, ruta_acceso, mime_type, peso_bytes, entidad_asociada, uuid_asociado, subido_por, subido_por_nombre texto+keyword, extension, carpeta, publico, activo, createdAt, updatedAt`.

### `config/queues.js` — 25 líneas

- `createQueue(nombre)`, `createWorker(nombre, procesador)` con Redis del entorno.

### `config/database/mysql.js` — 40 líneas

- `mysql2/promise createPool` límite 10, `keepAlive`, 5 reintentos 5s, lanza si falla.

### `config/database/redis.js` — 20 líneas

- Singleton `getRedisClient()` con `commandTimeout 5000`, `maxRetriesPerRequest 3`.

## 3. Carpeta `src/core/`

### `core/exceptions/` — 5 archivos

- `AppError` base, `NotFoundError` 404, `ValidationError` 400 con `errors`, `ConflictError` 409, `index.js` reexporta.

### `core/loaders/express.loader.js` — 61 líneas

- `helmet`, `cors`, `json`, `urlencoded`, `express-rate-limit 100/15min` en `/api/`.
- Monta `app.use('/api/v1/storage', archivoRoutes)`.
- `GET /healthz -> { status UP, service storage-service }`.
- Error final `{ success false, message, errors }`.

### `core/loaders/database.loader.js` — 15 líneas

- Solo `ensureStorageIndex()` con aviso no fatal. MySQL y Redis bajo demanda.

### `core/helpers/pagination.helper.js` — 20 líneas

- `getPaginationMeta(página, límite, total)` con `totalPages, hasNextPage, hasPrevPage`. El controlador arma paginación manual sin invocarla.

## 4. Carpeta `src/modules/archivo/` — 5 archivos

### `modules/archivo/archivo.validation.js` — 51 líneas

- `createFileMetadataSchema`: `entidadAsociada?, uuidAsociado uuid?, usuarioId int positivo coerce?, usuarioNombre?, carpeta defecto general, publico boolean coerce defecto false`.
- `updateFileSchema`: todo opcional `nombreOriginal 1..255, entidadAsociada, uuidAsociado uuid, carpeta, publico, activo`.
- `listFilesQuerySchema`: `page 1, limit 20 max100, usuarioId?, tipo?, entidad?, activo?`.
- `searchFilesQuerySchema`: `q o search min1`, mismos filtros más `offset 0, limit 20 max100`.

### `modules/archivo/archivo.service.js` — 173 líneas

- Multer `memoryStorage`, `fileFilter` solo `.pdf, .jpg, .jpeg, .png, .gif` en `ALLOWED_EXTENSIONS`, lanza `ValidationError` si no coincide, límite `MAX_FILE_SIZE`. Exporta `upload, fileFilter, ALLOWED_EXTENSIONS`.
- `uuidv4` para `nombre sistema ${uuid}${ext}` y `ruta path.join(UPLOAD_DIR, nombre)`.
- `uploadFile(multer, metadatos)`: crea en repo luego `esClient.index` por `uuid`, aviso si falla.
- `getFileById/getFileByUuid`: 404 `Archivo no encontrado` si falta.
- `listFiles({ page, limit, usuarioId, tipo, entidad, activo })`: delega.
- `updateFile(id, datos)`: MySQL luego `esClient.update`.
- `deleteFile(id)`: verifica, borrado lógico MySQL y `esClient.delete` por `uuid`.
- `searchFiles(consulta)`: delega a `searchInElasticsearch`.

### `modules/archivo/archivo.repository.js` — 266 líneas

- `crypto.randomUUID()` para `uuid`, `createMysqlPool` diferido, transacciones `begin/commit/rollback/release` en `create/update/delete`.
- Tabla `archivos` con `deleted_at` y `activo`, fechas `createdAt/updatedAt`.
- `findById/findByUuid` con `deleted_at NULL`.
- `findAll`: `WHERE` dinámico `subido_por, mime_type, entidad_asociada, activo`, `COUNT` + `LIMIT OFFSET ORDER BY createdAt DESC`, retorna `{ files, total }`.
- `create`: inserta 13 valores `activo 1 NOW`, retorna por `insertId`.
- `update`: parcial solo `nombre_original, entidad_asociada, uuid_asociado, carpeta, publico, activo` + `updatedAt NOW`.
- `delete`: lógico `deleted_at NOW activo 0`.
- `searchInElasticsearch`: `bool must multi_match fuzziness AUTO` en `nombre_original, nombre_sistema, carpeta` + 2 `wildcard`, `filter` por `subido_por, mime_type, entidad_asociada, activo`, `from/size`, orden `createdAt desc`, retorna `{ total, files }`.

### `modules/archivo/archivo.controller.js` — 172 líneas

- `uploadFile`: exige `req.file` 400, arma `metadata` desde `body` y `user`, `201 { success true, data }`.
- `getFileById`: convierte a entero, `200`.
- `getFileByUuid`: `200`.
- `listFiles`: lee `page/limit/usuarioId/tipo/entidad/activo`, responde `data` + `meta.pagination { page, limit, total, totalPages, hasNextPage, hasPrevPage }`.
- `updateFile`: parcial, `200`.
- `deleteFile`: lógico, `200 { success true }`.
- `searchFiles`: exige `q o search` 400, arma `offset/limit` y filtros, `meta.pagination { total, limit, offset, hasNextPage }`.

### `modules/archivo/archivo.routes.js` — 67 líneas

- Instancia única `Repository, Service, Controller`.
- `validateBody/validateQuery` con `safeParse` → `ValidationError`.
- Bajo `/api/v1/storage`: `POST /upload con upload.single file + createFileMetadataSchema`, `GET /search` antes de `/:id`, `GET /`, `GET /:id`, `GET /uuid/:uuid`, `PATCH /:id`, `DELETE /:id`.

## 5. Carpeta `src/jobs/` — 2 archivos

### `jobs/producers/storage.producer.js` — 93 líneas

- `StorageProducer` cola `STORAGE_QUEUE storage_jobs`.
- `indexFile -> index_file`, `updateFileInES -> update_file`, `deleteFileFromES -> delete_file { uuid, timestamp }`, `bulkProcessFiles -> bulk_process`. Todo `attempts 3`, `backoff 1000`, `removeOnComplete true`.
- Sin uso actual, servicio indexa directo con `esClient`.

### `jobs/consumers/storage.consumer.js` — 131 líneas

- `StorageConsumer` despacha por `job.name`: `handleIndexFile` indexa por `uuid`, `handleUpdateFile` actualiza parcial, `handleDeleteFile` elimina por `uuid`, `handleBulkProcess` arma `bulk { index {_index, _id uuid} }`. `close()` invocado en `server.js`.

## 6. Carpeta `src/docs/`

### `docs/swagger.yaml` — 469 líneas

- OpenAPI 3.0.3, `http://localhost:3011/api/v1/storage`, `bearerAuth` JWT.
- Esquemas `File` 17 campos, `FileUploadResponse`, `FileListResponse` por página, `SearchResponse` por desplazamiento, `ErrorResponse`, parámetros `PageParam, LimitParam, SearchParam`.
- Rutas: `POST /upload multipart file + entidadAsociada/uuidAsociado/carpeta/publico`, `GET /search`, `GET /`, `GET /{id}`, `GET /uuid/{uuid}`, `PATCH /{id}`, `DELETE /{id}` lógico.

### `docs/swagger.config.js` — 15 líneas

- Expone en `/api-docs` con `swagger-ui-express`.

## 7. Carpeta `tests/`

- `tests/setup.js` 27 líneas: `PORT 3011`, `test_storage_db`, `test_storage_jobs`, `test_uajs_storage`, `UPLOAD_DIR /tmp/uploads-test`, `CORS`.
- `jest.config.js` 15 líneas: `node`, `**/tests/**/*.test.js`, cobertura sin `server.js`, umbral 80 en ramas/funciones/líneas/sentencias.
- `tests/unit/` 7 archivos: `archivo.service/controller/repository/validation, config, storage.jobs, app.routes`.
- `tests/e2e/storage.e2e.test.js`: flujo completo.
- `fixtures` e `integration` vacías.
- `package.json`: `multer 1.4.5-lts.1`, `uuid 9.0.1`, `mysql2, bullmq, ioredis, winston, swagger-ui-express, yamljs, zod`, internos `file:`. Scripts `dev, test, test:unit, test:e2e, lint`.
- `.env.example` 16 líneas refleja `env.js`.

## 8. Cómo usar

```bash
cd apps/storage-service && npm run dev
curl http://localhost:3011/healthz
curl -X POST http://localhost:3011/api/v1/storage/upload -F "file=@/tmp/doc.pdf" -F "carpeta=general"
curl "http://localhost:3011/api/v1/storage?page=1&limit=10"
curl "http://localhost:3011/api/v1/storage/search?search=acta"
```
