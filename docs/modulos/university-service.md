# university-service — Documentación detallada por carpeta

> Puerto 3004. Rol: núcleo académico y aprovisionamiento `STUDENT` y `TEACHER`.
> 6 módulos x 5 archivos + `user-provisioning.service`. Doble ruta ES y EN. MySQL transaccional + ES + Redis + BullMQ dual.

## 1. Raíz `src/`

### `src/app.js` — 13 líneas

- `initApp()`: `express()` → `expressLoader` → `setupSwagger` → retorna `app`.

### `src/server.js` — 82 líneas

- `uncaughtException/unhandledRejection -> exit 1`.
- `startServer`: `await databaseLoader()` → `initApp()` → `new UniversityConsumer()` no fatal con `warn` → `listen(PORT)` con `EADDRINUSE`.
- Cierre `SIGTERM/SIGINT` con `server.close()`, `consumer.close()`, timeout 10s.

## 2. Carpeta `src/config/`

### `config/env.js`

- `PORT 3004`, `MYSQL_DATABASE uajs_academic`, `PASSWORD uajs206**`, `REDIS 6379`, `ES 9200`, `UNIVERSITY_QUEUE university_events`, `UNIVERSITY_INDEX uajs_university`, `UNIVERSITY_CACHE_TTL 3600`.

### `config/logger.js`

- Winston `json + timestamp`, `Console` + `ElasticsearchTransport` prefijo `uajs-logs`.

### `config/elasticsearch.js`

- `esClient` resiliente. `ensureUniversityIndex()`: crea `uajs_university` con `shards 3, replicas 1, dynamic false`, campos `type, id, uuid, nombre spanish, codigo, estado, numeroDocumento, email, telefono, relaciones nested, createdAt, updatedAt`.

### `config/queues.js`

- `createQueue(name)`, `createWorker(name, processor)` con `REDIS_HOST/PORT`.

### `config/database/mysql.js` — 28 líneas

- Singleton `getMysqlPool()` con `connectionLimit 10` y circuit breaker. Alias `createMySQLPool`.

### `config/database/redis.js`

- Singleton `getRedisClient()` con `commandTimeout 5000`, `maxRetriesPerRequest 3`.

## 3. Carpeta `src/core/`

### `core/loaders/express.loader.js` — 92 líneas

- `helmet`, `cors`, `json`, `urlencoded`, `rate-limit 200/15min` en `/api/`.
- Español: `/api/v1/universidad/empresas, terceros, facultades, programas, estudiantes, docentes`.
- Inglés alias mismo router: `/api/v1/university/companies, persons, faculties, programs, students, teachers`.
- Salud: `GET /api/v1/universidad/health`, `GET /api/v1/university/health`, `GET /healthz -> { status UP, service university-service, environment }`.
- Error final `{ success false, message, errors }`.

### `core/loaders/database.loader.js` — 29 líneas

- `ensureUniversityIndex()` + `pool.ping()` MySQL, ambos `warn` no fatal.

### `core/exceptions/`

- `AppError` base, `NotFoundError` 404, `ConflictError` 409, `ValidationError` 400 con `errors`, `index.js` reexporta.

### `core/helpers/pagination.helper.js`

- `paginationHelper(page 1, limit 20)` con `clamp 1..100` y `offset`, `paginateResult`, `getPaginationMeta`.

### `core/services/user-provisioning.service.js` — 151 líneas

- Clase `UserProvisioningService(pool?)`, `provisionUser({ person, roleName STUDENT|TEACHER, customPassword }, conn?)`.
- Genera `nombre.apellido.doc@estudiantes|docentes.uajs.edu.co`, `hashPassword` por defecto `uajs206**`, reutiliza si `email` existe en `uajs_auth.users`, crea `persons` con `ON DUPLICATE KEY`, crea `users`, asigna rol con `INSERT IGNORE` y respaldo `STUDENT 3 TEACHER 4`.
- Resiliente: si `uajs_auth` falla retorna `{ userUuid uuidv4, email, role }`.

## 4. Patrón común `src/modules/`

- Controller: `create 201`, `findAll 200 { data, pagination }`, `findById 200`, `update 200`, `delete 200`, `search 200`.
- Service: `create/findAll/findById/update/delete/search/invalidateCache/index`, `withTransaction`, ES no bloqueante, Redis `keys prefijo:* -> del`, `search` con `term + multi_match + fuzziness AUTO`.
- Repository: `getPool`, `withTransaction begin/commit/rollback/release`, `create` con `uuidv4`, `findAll COUNT + SELECT LIMIT OFFSET`, `findById` por id o uuid 36, `update` con mezcla, `delete` lógico `is_active 0`.
- Validation: 3 Zod por módulo `create` estricto, `update` opcional, `query` con `page/limit` coerce.
- Routes: `GET /search`, `GET / con query`, `POST / con body`, `GET /:id`, `PUT /:id`, `DELETE /:id`. `validate(schema, body|query)` con detalle `field/message`.

## 5. Carpeta `src/modules/empresa/` — tabla `companies`

- Service: verifica `findByNit 409`, `delete` con `countAssociatedTerceros` stub 0, indexa `empresa_id` con `{ nombre razonSocial, codigo/nnumeroDocumento nit, estado, email, telefono }`, busca `[nombre, codigo, numeroDocumento, email, telefono]`.
- Repository: mapea `razonSocial/legal_name, nombreComercial/trade_name, nit/tax_id, digitoVerificacion/check_digit, direccion/address, telefono/phone, email, cityUuid/uuid, cityName/name, activo/is_active`. `findAll` filtra `legal_name/trade_name/tax_id LIKE`, `findByNit`, `delete is_active 0`.
- Validation body: `create razonSocial min2 max200, nit min3 max20, nombreComercial?, digitoVerificacion?, direccion?, telefono?, email?, cityUuid uuid?, cityName?, nombreCiudad?, activo true`. Query: `page 1, limit 20 max100, search?`.
- Rutas ES `/api/v1/universidad/empresas` y EN `/api/v1/university/companies`.

## 6. Carpeta `src/modules/tercero/` — tabla `persons`

- Service: verifica `findByDocumento 409`, `delete` verifica `countStudentLinks` y `countTeacherLinks 409`, indexa `tercero` con `relaciones` empresa si existe.
- Repository: `SELECT` con `CONCAT AS nombre`, `create` exige `tipoDocumento/numeroDocumento/primerNombre/primerApellido`, `findAll` con `is_active 1 deleted_at NULL`, `search` en `first_name/last_name/document_number/email`, filtro `document_type_code`, `findByDocumento`, `delete is_active 0 deleted_at NOW`, `formatPersonRow` con `Empresa null`.
- Validation body: `create tipoDocumento min1 max10, numeroDocumento min3 max30, primerNombre/primerApellido, segundoNombre/segundoApellido?, fechaNacimiento YYYY-MM-DD?, genero M|F|X?, email?, telefono?, direccion?, cityUuid?, cityName?, nombreCiudad?, activo true`. Query: `page, limit, search?, tipoDocumento?`.
- Dependencia de `Estudiante` y `Docente` para validar `personaId 404`.

## 7. Carpeta `src/modules/facultad/` — tabla `faculties`

- Service: verifica `findByCodigo` y `findByNombre 409`, `delete` verifica `countProgramLinks` y `countTeacherLinks 409`, indexa con `relaciones [{ type sede, id campusId }]`, busca `[nombre, codigo, email]`.
- Repository: `campus_id->campusId, code->codigo, name->nombre, dean_name->decano, email, is_active->activo`. `create campusId defecto 1`, `findAll { search, campusId }`, `findByCodigo/Nombre`.
- Validation body: `create campusId coerce positivo defecto 1, codigo min2 max20, nombre min2 max150, decano?, nombreDecano?, email?, activo true`. Query: `page, limit, search?, campusId?`.
- Dependencia de `Programa` y `Docente`.

## 8. Carpeta `src/modules/programa/` — tabla `programs`

- Service: valida `facultadId` con `FacultadRepository 404`, duplicados `codigo/nombre 409`, `delete` verifica `countStudentLinks 409`, indexa con `numeroDocumento codigoSnies` y `relaciones facultad`, busca `[nombre, codigo, numeroDocumento]`.
- Repository: `faculty_id->facultadId, code->codigo, name->nombre, level->nivel, duration_semesters->duracionSemestres, total_credits->creditosTotales, snies_code->codigoSnies`. `findAll { search, facultadId, nivel }` con `JOIN faculties`, anida `{ Facultad/facultad }`.
- Validation body: `create facultadId coerce, codigo/nombre, nivel undergraduate|specialization|masters|doctorate|technologist|technician defecto undergraduate, duracionSemestres 1..20, creditosTotales 1..500, codigoSnies?, activo true`. Query: `page, limit, search?, facultadId?, nivel?`.
- Dependencia de `Estudiante`.

## 9. Carpeta `src/modules/estudiante/` — tabla `students`

- Service 300 líneas: valida `persona 404`, `programa 404`, `findByCodigo 409`, `findByPersonaId 409` una persona un estudiante, si sin `userUuid` llama `provisionUser STUDENT` con `password`, luego `withTransaction(create)`. Indexa con `relaciones [tercero, programa]`. Búsqueda reforzada `multi_match + wildcard codigo/numeroDocumento`.
- Repository: `person_id->personaId, program_id->programaId, user_uuid->userUuid, student_code->codigoEstudiante, enrollment_date->fechaMatricula hoy, graduation_date->fechaGraduacion, current_semester->semestreActual 1, gpa->promedio, status->estado active`. `findAll { search, programaId, personaId, estado }` con `JOIN persons+programs`, anida `{ Tercero/tercero, Programa/programa }`.
- Validation body: `create personaId/programaId coerce, userUuid uuid?, password min6?, codigoEstudiante min2 max20, fechaMatricula hoy, fechaGraduacion?, semestreActual 1..20 defecto 1, promedio 0..5?, estado active|inactive|graduated|withdrawn|suspended defecto active, activo true`. `update` sin `personaId`. Query con `programaId?, personaId?, estado?`.
- Rutas ES `/estudiantes` y EN `/students`.

## 10. Carpeta `src/modules/docente/` — tabla `teachers`

- Gemelo de estudiante con `roleName TEACHER`, filtro extra `tipoContrato`, `relaciones [tercero, facultad]`.
- Repository: `faculty_id->facultadId, teacher_code->codigoDocente, contract_type->tipoContrato full_time, hire_date->fechaContratacion hoy, termination_date->fechaTerminacion, academic_degree->tituloAcademico, status->estado active`. `findAll { search, facultadId, personaId, estado, tipoContrato }`.
- Validation body: `create personaId/facultadId coerce, userUuid?, password?, codigoDocente min2 max20, tipoContrato full_time|part_time|visiting|honorary defecto full_time, fechaContratacion hoy, fechaTerminacion?, tituloAcademico max80?, estado active|inactive|retired defecto active`. Query añade `tipoContrato?`.
- Rutas ES `/docentes` y EN `/teachers`.

## 11. Carpeta `src/jobs/`

### `jobs/producers/university.producer.js` — 48 líneas

- `UniversityProducer`, `addUniversityEvent` → `log_university_event` y `publishEntitySync` → `sync_university_entity` con `attempts 3`, `removeOnComplete 100`. Sin uso actual, indexación directa en servicios.

### `jobs/consumers/university.consumer.js` — 67 líneas

- `log_university_event` → indexa `uajs_university_events`, `sync_university_entity` → `index/delete id entityType_id` en `uajs_university`. `close()` para apagado.

## 12. Carpeta `src/docs/`

### `docs/swagger.config.js`

- Monta en `/api/docs` título `University Service API`.

### `docs/swagger.yaml` — 847 líneas

- OpenAPI 3.0.3, `servers localhost:3004` y `gateway 3000`.
- Solo prefijo ES: `/health`, `/empresas`, `/terceros`, `/facultades`, `/programas`, `/estudiantes`, `/docentes` con `GET/POST 201/400/404/409/PUT/DELETE` y `Create/Update Dto` con ejemplos `FING, SIS-01, EST-2026-0001, DOC-101`.

## 13. Carpeta `tests/`

- `jest.config.js`: `testMatch **/tests/**/*.test.js`, cobertura sin `server.js`, umbrales `branches 70, functions/lines/statements 80`.
- `tests/setup.js`: fija `uajs_academic_test`, `test_university_events`, mock `logger`.
- `tests/unit/` 14 ficheros: `config/logger|elasticsearch`, `core/exceptions|loaders|pagination|user-provisioning`, `modules/empresa|tercero|facultad|programa|estudiante|docente|controllers|services|repositories`, `jobs/university.jobs`.
- `tests/e2e/university.e2e.test.js` 157 líneas: `supertest(initApp())` con MySQL y ES mockeados, verifica salud, `GET` 200 por módulo, `POST` inválido 400, `search` 200.
- `tests/integration/.gitkeep`, `fixtures/.gitkeep` vacíos.
- `tests/university-service.http` 307 líneas: `serviceUrl 3004 gatewayUrl 3000`, CRUD por módulo, nota aprovisionamiento con `uajs206**`.

## 14. Cómo usar

```bash
cd apps/university-service && npm run dev
curl http://localhost:3004/api/v1/universidad/health
curl "http://localhost:3004/api/v1/universidad/facultades?page=1&limit=10"
curl -X POST http://localhost:3004/api/v1/universidad/estudiantes -H "Content-Type: application/json" -d '{"personaId":1,"programaId":2,"codigoEstudiante":"2026-001"}'
```
