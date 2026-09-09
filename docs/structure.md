´´´´sql
mysql -uroot -puajs206**
SHOW DATABASES;
SHOW TABLES;
SELECT * FROM departments;
USE uajs_catalog;
SELECT * FROM document_types;

´´´´

```text
uajs-smart-campus-monorepo/
│
├── apps/
│   ├── api-gateway/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES para logs
│   │   │   ├── core/
│   │   │   │   └── rateLimiter/
│   │   │   │       └── tokenBucket.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.js
│   │   │   │   ├── rateLimit.middleware.js
│   │   │   │   ├── requestId.middleware.js
│   │   │   │   └── proxy.middleware.js
│   │   │   ├── routes/
│   │   │   │   ├── index.routes.js
│   │   │   │   └── health.routes.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── auth.middleware.test.js
│   │   │   │   ├── rateLimit.middleware.test.js
│   │   │   │   ├── proxy.middleware.test.js
│   │   │   │   └── tokenBucket.test.js
│   │   │   └── e2e/
│   │   │       └── gateway.e2e.test.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── auth-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   ├── TooManyRequestsError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── rateLimiter/
│   │   │   │   │   └── tokenBucket.js
│   │   │   │   └── loaders/
│   │   │   │       ├── express.loader.js
│   │   │   │       └── database.loader.js
│   │   │   ├── modules/
│   │   │   │   └── auth/
│   │   │   │       ├── auth.controller.js
│   │   │   │       ├── auth.service.js
│   │   │   │       ├── auth.repository.js
│   │   │   │       ├── auth.validation.js
│   │   │   │       └── auth.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── email.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── email.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   └── auth.service.test.js
│   │   │   ├── integration/
│   │   │   │   └── auth.repository.test.js
│   │   │   └── e2e/
│   │   │       └── auth.e2e.test.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── catalog-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── loaders/
│   │   │   │   │   ├── express.loader.js
│   │   │   │   │   └── database.loader.js
│   │   │   │   └── helpers/
│   │   │   │       └── pagination.helper.js
│   │   │   ├── modules/
│   │   │   │   ├── departamento/
│   │   │   │   │   ├── departamento.controller.js
│   │   │   │   │   ├── departamento.service.js
│   │   │   │   │   ├── departamento.repository.js
│   │   │   │   │   ├── departamento.validation.js
│   │   │   │   │   └── departamento.routes.js
│   │   │   │   ├── ciudad/
│   │   │   │   │   ├── ciudad.controller.js
│   │   │   │   │   ├── ciudad.service.js
│   │   │   │   │   ├── ciudad.repository.js
│   │   │   │   │   ├── ciudad.validation.js
│   │   │   │   │   └── ciudad.routes.js
│   │   │   │   ├── sede/
│   │   │   │   │   ├── sede.controller.js
│   │   │   │   │   ├── sede.service.js
│   │   │   │   │   ├── sede.repository.js
│   │   │   │   │   ├── sede.validation.js
│   │   │   │   │   └── sede.routes.js
│   │   │   │   └── tipo-documento/
│   │   │   │       ├── tipo-documento.controller.js
│   │   │   │       ├── tipo-documento.service.js
│   │   │   │       ├── tipo-documento.repository.js
│   │   │   │       ├── tipo-documento.validation.js
│   │   │   │       └── tipo-documento.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── catalog.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── catalog.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── departamento.service.test.js
│   │   │   │   ├── ciudad.service.test.js
│   │   │   │   ├── sede.service.test.js
│   │   │   │   └── tipo-documento.service.test.js
│   │   │   ├── integration/
│   │   │   │   ├── departamento.repository.test.js
│   │   │   │   ├── ciudad.repository.test.js
│   │   │   │   ├── sede.repository.test.js
│   │   │   │   └── tipo-documento.repository.test.js
│   │   │   ├── e2e/
│   │   │   │   ├── departamento.e2e.test.js
│   │   │   │   ├── ciudad.e2e.test.js
│   │   │   │   ├── sede.e2e.test.js
│   │   │   │   └── tipo-documento.e2e.test.js
│   │   │   └── fixtures/
│   │   │       └── catalog.fixtures.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── user-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── loaders/
│   │   │   │   │   ├── express.loader.js
│   │   │   │   │   └── database.loader.js
│   │   │   │   └── helpers/
│   │   │   │       └── pagination.helper.js
│   │   │   ├── modules/
│   │   │   │   ├── usuario/
│   │   │   │   │   ├── usuario.controller.js
│   │   │   │   │   ├── usuario.service.js
│   │   │   │   │   ├── usuario.repository.js
│   │   │   │   │   ├── usuario.validation.js
│   │   │   │   │   └── usuario.routes.js
│   │   │   │   ├── rol/
│   │   │   │   │   ├── rol.controller.js
│   │   │   │   │   ├── rol.service.js
│   │   │   │   │   ├── rol.repository.js
│   │   │   │   │   ├── rol.validation.js
│   │   │   │   │   └── rol.routes.js
│   │   │   │   └── permiso/
│   │   │   │       ├── permiso.controller.js
│   │   │   │       ├── permiso.service.js
│   │   │   │       ├── permiso.repository.js
│   │   │   │       ├── permiso.validation.js
│   │   │   │       └── permiso.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── user.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── user.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── usuario.service.test.js
│   │   │   │   ├── rol.service.test.js
│   │   │   │   └── permiso.service.test.js
│   │   │   ├── integration/
│   │   │   │   ├── usuario.repository.test.js
│   │   │   │   ├── rol.repository.test.js
│   │   │   │   └── permiso.repository.test.js
│   │   │   ├── e2e/
│   │   │   │   ├── usuario.e2e.test.js
│   │   │   │   ├── rol.e2e.test.js
│   │   │   │   ├── permiso.e2e.test.js
│   │   │   │   └── perfil.e2e.test.js
│   │   │   └── fixtures/
│   │   │       └── user.fixtures.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── university-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── loaders/
│   │   │   │   │   ├── express.loader.js
│   │   │   │   │   └── database.loader.js
│   │   │   │   └── helpers/
│   │   │   │       └── pagination.helper.js
│   │   │   ├── modules/
│   │   │   │   ├── empresa/
│   │   │   │   │   ├── empresa.controller.js
│   │   │   │   │   ├── empresa.service.js
│   │   │   │   │   ├── empresa.repository.js
│   │   │   │   │   ├── empresa.validation.js
│   │   │   │   │   └── empresa.routes.js
│   │   │   │   ├── tercero/
│   │   │   │   │   ├── tercero.controller.js
│   │   │   │   │   ├── tercero.service.js
│   │   │   │   │   ├── tercero.repository.js
│   │   │   │   │   ├── tercero.validation.js
│   │   │   │   │   └── tercero.routes.js
│   │   │   │   ├── estudiante/
│   │   │   │   │   ├── estudiante.controller.js
│   │   │   │   │   ├── estudiante.service.js
│   │   │   │   │   ├── estudiante.repository.js
│   │   │   │   │   ├── estudiante.validation.js
│   │   │   │   │   └── estudiante.routes.js
│   │   │   │   ├── docente/
│   │   │   │   │   ├── docente.controller.js
│   │   │   │   │   ├── docente.service.js
│   │   │   │   │   ├── docente.repository.js
│   │   │   │   │   ├── docente.validation.js
│   │   │   │   │   └── docente.routes.js
│   │   │   │   ├── facultad/
│   │   │   │   │   ├── facultad.controller.js
│   │   │   │   │   ├── facultad.service.js
│   │   │   │   │   ├── facultad.repository.js
│   │   │   │   │   ├── facultad.validation.js
│   │   │   │   │   └── facultad.routes.js
│   │   │   │   └── programa/
│   │   │   │       ├── programa.controller.js
│   │   │   │       ├── programa.service.js
│   │   │   │       ├── programa.repository.js
│   │   │   │       ├── programa.validation.js
│   │   │   │       └── programa.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── university.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── university.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── empresa.service.test.js
│   │   │   │   ├── tercero.service.test.js
│   │   │   │   ├── estudiante.service.test.js
│   │   │   │   ├── docente.service.test.js
│   │   │   │   ├── facultad.service.test.js
│   │   │   │   └── programa.service.test.js
│   │   │   ├── integration/
│   │   │   │   ├── empresa.repository.test.js
│   │   │   │   ├── tercero.repository.test.js
│   │   │   │   ├── estudiante.repository.test.js
│   │   │   │   ├── docente.repository.test.js
│   │   │   │   ├── facultad.repository.test.js
│   │   │   │   └── programa.repository.test.js
│   │   │   ├── e2e/
│   │   │   │   ├── empresa.e2e.test.js
│   │   │   │   ├── tercero.e2e.test.js
│   │   │   │   ├── estudiante.e2e.test.js
│   │   │   │   ├── docente.e2e.test.js
│   │   │   │   ├── facultad.e2e.test.js
│   │   │   │   └── programa.e2e.test.js
│   │   │   └── fixtures/
│   │   │       └── university.fixtures.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── resource-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── loaders/
│   │   │   │   │   ├── express.loader.js
│   │   │   │   │   └── database.loader.js
│   │   │   │   └── helpers/
│   │   │   │       └── pagination.helper.js
│   │   │   ├── modules/
│   │   │   │   ├── tipo-recurso/
│   │   │   │   │   ├── tipo-recurso.controller.js
│   │   │   │   │   ├── tipo-recurso.service.js
│   │   │   │   │   ├── tipo-recurso.repository.js
│   │   │   │   │   ├── tipo-recurso.validation.js
│   │   │   │   │   └── tipo-recurso.routes.js
│   │   │   │   ├── recurso/
│   │   │   │   │   ├── recurso.controller.js
│   │   │   │   │   ├── recurso.service.js
│   │   │   │   │   ├── recurso.repository.js
│   │   │   │   │   ├── recurso.validation.js
│   │   │   │   │   └── recurso.routes.js
│   │   │   │   └── estado-recurso/
│   │   │   │       ├── estado-recurso.controller.js
│   │   │   │       ├── estado-recurso.service.js
│   │   │   │       ├── estado-recurso.repository.js
│   │   │   │       ├── estado-recurso.validation.js
│   │   │   │       └── estado-recurso.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── resource.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── resource.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── tipo-recurso.service.test.js
│   │   │   │   ├── recurso.service.test.js
│   │   │   │   └── estado-recurso.service.test.js
│   │   │   ├── integration/
│   │   │   │   ├── tipo-recurso.repository.test.js
│   │   │   │   ├── recurso.repository.test.js
│   │   │   │   └── estado-recurso.repository.test.js
│   │   │   ├── e2e/
│   │   │   │   ├── tipo-recurso.e2e.test.js
│   │   │   │   ├── recurso.e2e.test.js
│   │   │   │   └── estado-recurso.e2e.test.js
│   │   │   └── fixtures/
│   │   │       └── resource.fixtures.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── booking-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── loaders/
│   │   │   │   │   ├── express.loader.js
│   │   │   │   │   └── database.loader.js
│   │   │   │   └── helpers/
│   │   │   │       └── pagination.helper.js
│   │   │   ├── modules/
│   │   │   │   ├── tipo-reserva/
│   │   │   │   │   ├── tipo-reserva.controller.js
│   │   │   │   │   ├── tipo-reserva.service.js
│   │   │   │   │   ├── tipo-reserva.repository.js
│   │   │   │   │   ├── tipo-reserva.validation.js
│   │   │   │   │   └── tipo-reserva.routes.js
│   │   │   │   ├── reserva/
│   │   │   │   │   ├── reserva.controller.js
│   │   │   │   │   ├── reserva.service.js
│   │   │   │   │   ├── reserva.repository.js
│   │   │   │   │   ├── reserva.validation.js
│   │   │   │   │   └── reserva.routes.js
│   │   │   │   └── estado-reserva/
│   │   │   │       ├── estado-reserva.controller.js
│   │   │   │       ├── estado-reserva.service.js
│   │   │   │       ├── estado-reserva.repository.js
│   │   │   │       ├── estado-reserva.validation.js
│   │   │   │       └── estado-reserva.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── reserva.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── reserva.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── tipo-reserva.service.test.js
│   │   │   │   ├── reserva.service.test.js
│   │   │   │   └── estado-reserva.service.test.js
│   │   │   ├── integration/
│   │   │   │   ├── tipo-reserva.repository.test.js
│   │   │   │   ├── reserva.repository.test.js
│   │   │   │   └── estado-reserva.repository.test.js
│   │   │   ├── e2e/
│   │   │   │   ├── tipo-reserva.e2e.test.js
│   │   │   │   ├── reserva.e2e.test.js
│   │   │   │   └── estado-reserva.e2e.test.js
│   │   │   └── fixtures/
│   │   │       └── booking.fixtures.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── request-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── loaders/
│   │   │   │   │   ├── express.loader.js
│   │   │   │   │   └── database.loader.js
│   │   │   │   └── helpers/
│   │   │   │       └── pagination.helper.js
│   │   │   ├── modules/
│   │   │   │   ├── tipo-solicitud/
│   │   │   │   │   ├── tipo-solicitud.controller.js
│   │   │   │   │   ├── tipo-solicitud.service.js
│   │   │   │   │   ├── tipo-solicitud.repository.js
│   │   │   │   │   ├── tipo-solicitud.validation.js
│   │   │   │   │   └── tipo-solicitud.routes.js
│   │   │   │   ├── solicitud/
│   │   │   │   │   ├── solicitud.controller.js
│   │   │   │   │   ├── solicitud.service.js
│   │   │   │   │   ├── solicitud.repository.js
│   │   │   │   │   ├── solicitud.validation.js
│   │   │   │   │   └── solicitud.routes.js
│   │   │   │   └── estado-solicitud/
│   │   │   │       ├── estado-solicitud.controller.js
│   │   │   │       ├── estado-solicitud.service.js
│   │   │   │       ├── estado-solicitud.repository.js
│   │   │   │       ├── estado-solicitud.validation.js
│   │   │   │       └── estado-solicitud.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── solicitud.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── solicitud.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── tipo-solicitud.service.test.js
│   │   │   │   ├── solicitud.service.test.js
│   │   │   │   └── estado-solicitud.service.test.js
│   │   │   ├── integration/
│   │   │   │   ├── tipo-solicitud.repository.test.js
│   │   │   │   ├── solicitud.repository.test.js
│   │   │   │   └── estado-solicitud.repository.test.js
│   │   │   ├── e2e/
│   │   │   │   ├── tipo-solicitud.e2e.test.js
│   │   │   │   ├── solicitud.e2e.test.js
│   │   │   │   └── estado-solicitud.e2e.test.js
│   │   │   └── fixtures/
│   │   │       └── request.fixtures.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── event-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── loaders/
│   │   │   │   │   ├── express.loader.js
│   │   │   │   │   └── database.loader.js
│   │   │   │   └── helpers/
│   │   │   │       └── pagination.helper.js
│   │   │   ├── modules/
│   │   │   │   ├── tipo-evento/
│   │   │   │   │   ├── tipo-evento.controller.js
│   │   │   │   │   ├── tipo-evento.service.js
│   │   │   │   │   ├── tipo-evento.repository.js
│   │   │   │   │   ├── tipo-evento.validation.js
│   │   │   │   │   └── tipo-evento.routes.js
│   │   │   │   ├── evento/
│   │   │   │   │   ├── evento.controller.js
│   │   │   │   │   ├── evento.service.js
│   │   │   │   │   ├── evento.repository.js
│   │   │   │   │   ├── evento.validation.js
│   │   │   │   │   └── evento.routes.js
│   │   │   │   └── estado-evento/
│   │   │   │       ├── estado-evento.controller.js
│   │   │   │       ├── estado-evento.service.js
│   │   │   │       ├── estado-evento.repository.js
│   │   │   │       ├── estado-evento.validation.js
│   │   │   │       └── estado-evento.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── evento.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── evento.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── tipo-evento.service.test.js
│   │   │   │   ├── evento.service.test.js
│   │   │   │   └── estado-evento.service.test.js
│   │   │   ├── integration/
│   │   │   │   ├── tipo-evento.repository.test.js
│   │   │   │   ├── evento.repository.test.js
│   │   │   │   └── estado-evento.repository.test.js
│   │   │   ├── e2e/
│   │   │   │   ├── tipo-evento.e2e.test.js
│   │   │   │   ├── evento.e2e.test.js
│   │   │   │   └── estado-evento.e2e.test.js
│   │   │   └── fixtures/
│   │   │       └── event.fixtures.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── notification-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── loaders/
│   │   │   │   │   ├── express.loader.js
│   │   │   │   │   └── database.loader.js
│   │   │   │   └── helpers/
│   │   │   │       └── pagination.helper.js
│   │   │   ├── modules/
│   │   │   │   ├── tipo-notificacion/
│   │   │   │   │   ├── tipo-notificacion.controller.js
│   │   │   │   │   ├── tipo-notificacion.service.js
│   │   │   │   │   ├── tipo-notificacion.repository.js
│   │   │   │   │   ├── tipo-notificacion.validation.js
│   │   │   │   │   └── tipo-notificacion.routes.js
│   │   │   │   ├── notificacion/
│   │   │   │   │   ├── notificacion.controller.js
│   │   │   │   │   ├── notificacion.service.js
│   │   │   │   │   ├── notificacion.repository.js
│   │   │   │   │   ├── notificacion.validation.js
│   │   │   │   │   └── notificacion.routes.js
│   │   │   │   └── estado-notificacion/
│   │   │   │       ├── estado-notificacion.controller.js
│   │   │   │       ├── estado-notificacion.service.js
│   │   │   │       ├── estado-notificacion.repository.js
│   │   │   │       ├── estado-notificacion.validation.js
│   │   │   │       └── estado-notificacion.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── notificacion.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── notificacion.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── tipo-notificacion.service.test.js
│   │   │   │   ├── notificacion.service.test.js
│   │   │   │   └── estado-notificacion.service.test.js
│   │   │   ├── integration/
│   │   │   │   ├── tipo-notificacion.repository.test.js
│   │   │   │   ├── notificacion.repository.test.js
│   │   │   │   └── estado-notificacion.repository.test.js
│   │   │   ├── e2e/
│   │   │   │   ├── tipo-notificacion.e2e.test.js
│   │   │   │   ├── notificacion.e2e.test.js
│   │   │   │   └── estado-notificacion.e2e.test.js
│   │   │   └── fixtures/
│   │   │       └── notification.fixtures.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   ├── pqrs-service/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database/
│   │   │   │   │   ├── mysql.js
│   │   │   │   │   └── redis.js
│   │   │   │   ├── env.js
│   │   │   │   ├── logger.js
│   │   │   │   ├── queues.js
│   │   │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│   │   │   ├── core/
│   │   │   │   ├── exceptions/
│   │   │   │   │   ├── AppError.js
│   │   │   │   │   ├── NotFoundError.js
│   │   │   │   │   ├── UnauthorizedError.js
│   │   │   │   │   ├── ConflictError.js
│   │   │   │   │   ├── ValidationError.js
│   │   │   │   │   └── error.handler.js
│   │   │   │   ├── loaders/
│   │   │   │   │   ├── express.loader.js
│   │   │   │   │   └── database.loader.js
│   │   │   │   └── helpers/
│   │   │   │       └── pagination.helper.js
│   │   │   ├── modules/
│   │   │   │   ├── tipo-pqrs/
│   │   │   │   │   ├── tipo-pqrs.controller.js
│   │   │   │   │   ├── tipo-pqrs.service.js
│   │   │   │   │   ├── tipo-pqrs.repository.js
│   │   │   │   │   ├── tipo-pqrs.validation.js
│   │   │   │   │   └── tipo-pqrs.routes.js
│   │   │   │   ├── pqrs/
│   │   │   │   │   ├── pqrs.controller.js
│   │   │   │   │   ├── pqrs.service.js
│   │   │   │   │   ├── pqrs.repository.js
│   │   │   │   │   ├── pqrs.validation.js
│   │   │   │   │   └── pqrs.routes.js
│   │   │   │   └── estado-pqrs/
│   │   │   │       ├── estado-pqrs.controller.js
│   │   │   │       ├── estado-pqrs.service.js
│   │   │   │       ├── estado-pqrs.repository.js
│   │   │   │       ├── estado-pqrs.validation.js
│   │   │   │       └── estado-pqrs.routes.js
│   │   │   ├── jobs/
│   │   │   │   ├── producers/
│   │   │   │   │   └── pqrs.producer.js
│   │   │   │   └── consumers/
│   │   │   │       └── pqrs.consumer.js
│   │   │   ├── docs/
│   │   │   │   ├── swagger.yaml
│   │   │   │   └── swagger.config.js
│   │   │   ├── app.js
│   │   │   └── server.js
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── tipo-pqrs.service.test.js
│   │   │   │   ├── pqrs.service.test.js
│   │   │   │   └── estado-pqrs.service.test.js
│   │   │   ├── integration/
│   │   │   │   ├── tipo-pqrs.repository.test.js
│   │   │   │   ├── pqrs.repository.test.js
│   │   │   │   └── estado-pqrs.repository.test.js
│   │   │   ├── e2e/
│   │   │   │   ├── tipo-pqrs.e2e.test.js
│   │   │   │   ├── pqrs.e2e.test.js
│   │   │   │   └── estado-pqrs.e2e.test.js
│   │   │   └── fixtures/
│   │   │       └── pqrs.fixtures.js
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── README.md
│   │
│   └── storage-service/
│       ├── src/
│       │   ├── config/
│       │   │   ├── database/
│       │   │   │   ├── mysql.js
│       │   │   │   └── redis.js
│       │   │   ├── env.js
│       │   │   ├── logger.js
│       │   │   ├── storage.js
│       │   │   ├── queues.js
│       │   │   └── elasticsearch.js  # ✅ Configuración del cliente ES
│       │   ├── core/
│       │   │   ├── exceptions/
│       │   │   │   ├── AppError.js
│       │   │   │   ├── NotFoundError.js
│       │   │   │   ├── UnauthorizedError.js
│       │   │   │   ├── ConflictError.js
│       │   │   │   ├── ValidationError.js
│       │   │   │   └── error.handler.js
│       │   │   ├── loaders/
│       │   │   │   ├── express.loader.js
│       │   │   │   └── database.loader.js
│       │   │   └── helpers/
│       │   │       └── pagination.helper.js
│       │   ├── modules/
│       │   │   └── archivo/
│       │   │       ├── archivo.controller.js
│       │   │       ├── archivo.service.js
│       │   │       ├── archivo.repository.js
│       │   │       ├── archivo.validation.js
│       │   │       └── archivo.routes.js
│       │   ├── jobs/
│       │   │   ├── producers/
│       │   │   │   └── storage.producer.js
│       │   │   └── consumers/
│       │   │       └── storage.consumer.js
│       │   ├── docs/
│       │   │   ├── swagger.yaml
│       │   │   └── swagger.config.js
│       │   ├── app.js
│       │   └── server.js
│       ├── tests/
│       │   ├── unit/
│       │   │   └── archivo.service.test.js
│       │   ├── integration/
│       │   │   └── archivo.repository.test.js
│       │   ├── e2e/
│       │   │   └── archivo.e2e.test.js
│       │   └── fixtures/
│       │       └── storage.fixtures.js
│       ├── package.json
│       ├── Dockerfile
│       ├── .env.example
│       └── README.md
│
├── packages/
│   ├── shared-types/
│   │   ├── src/
│   │   │   ├── user.types.js
│   │   │   ├── domain.types.js
│   │   │   └── event.types.js
│   │   ├── package.json
│   │   └── index.js
│   │
│   ├── shared-utils/
│   │   ├── src/
│   │   │   ├── logger.js
│   │   │   ├── crypto.js
│   │   │   ├── response.js
│   │   │   ├── constants.js
│   │   │   └── tokenBucket.js
│   │   ├── package.json
│   │   └── index.js
│   │
│   ├── database-client/
│   │   ├── src/
│   │   │   ├── mysql.js
│   │   │   └── redis.js
│   │   ├── package.json
│   │   └── index.js
│   │
│   └── shared-elasticsearch/  # ✅ NUEVO: Paquete compartido para Elasticsearch
│       ├── src/
│       │   ├── client.js          # Cliente de Elasticsearch
│       │   ├── index.js           # Exporta el cliente y utilidades
│       │   ├── mappings/          # Definiciones de mapeos por servicio
│       │   │   ├── user.mapping.js
│       │   │   ├── event.mapping.js
│       │   │   ├── resource.mapping.js
│       │   │   ├── booking.mapping.js
│       │   │   ├── catalog.mapping.js
│       │   │   ├── university.mapping.js
│       │   │   ├── request.mapping.js
│       │   │   ├── notification.mapping.js
│       │   │   ├── pqrs.mapping.js
│       │   │   ├── storage.mapping.js
│       │   │   ├── auth.mapping.js
│       │   │   └── gateway.mapping.js
│       │   ├── queries/           # Consultas predefinidas
│       │   │   ├── user.queries.js
│       │   │   ├── event.queries.js
│       │   │   ├── resource.queries.js
│       │   │   ├── booking.queries.js
│       │   │   ├── catalog.queries.js
│       │   │   ├── university.queries.js
│       │   │   ├── request.queries.js
│       │   │   ├── notification.queries.js
│       │   │   ├── pqrs.queries.js
│       │   │   ├── storage.queries.js
│       │   │   └── logs.queries.js
│       │   └── utils/
│       │       ├── logger.js      # Logger para Elasticsearch
│       │       ├── errorHandler.js
│       │       └── indexHelper.js # Ayuda para indexar/actualizar documentos
│       ├── package.json
│       └── README.md
│
├── infrastructure/
│   ├── docker/
│   │   ├── init/
│   │   │   └── 01-schema.sql
│   │   ├── docker-compose.yml
│   │   ├── Dockerfile.base
│   │   └── README.md
│   │
│   ├── kubernetes/
│   │   ├── namespace.yml
│   │   ├── ingress.yml
│   │   ├── configmaps.yml
│   │   ├── secrets.yml
│   │   ├── api-gateway/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── auth-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── catalog-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── university-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── user-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── request-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── booking-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── resource-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── event-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── notification-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── pqrs-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   ├── storage-service/
│   │   │   ├── deployment.yml
│   │   │   └── service.yml
│   │   └── README.md
│   │
│   ├── elasticsearch/  # ✅ NUEVO: Configuración de Elasticsearch
│   │   ├── docker-compose.yml  # Configuración para desarrollo
│   │   ├── kubernetes/         # Configuración para producción (ECK)
│   │   │   ├── elasticsearch.yml
│   │   │   ├── kibana.yml
│   │   │   ├── filebeat.yml    # Opcional: para logs
│   │   │   └── logstash.yml    # Opcional: para procesamiento de logs
│   │   ├── config/
│   │   │   ├── elasticsearch.yml
│   │   │   └── kibana.yml
│   │   ├── scripts/
│   │   │   ├── setup.sh        # Script para configuración inicial
│   │   │   └── reindex.sh      # Script para reindexar datos
│   │   └── README.md
│   │
│   ├── secrets/
│   │   ├── README.md
│   │   ├── elasticsearch.env.example  # ✅ Credenciales de Elasticsearch
│   │   └── vault.hcl.example
│   │
│   └── nginx/
│       └── nginx.conf
│
├── scripts/
│   ├── seed/
│   │   ├── seed-universidad.js
│   │   └── seed-servicios.js
│   ├── migrations/
│   │   ├── migrate.js
│   │   └── 001_init.sql
│   ├── healthcheck.js
│   ├── deploy.sh
│   └── elasticsearch/  # ✅ NUEVO: Scripts para Elasticsearch
│       ├── index-all.js       # Indexar todos los datos en ES
│       ├── setup-mappings.js   # Configurar mapeos
│       └── reindex.js          # Reindexar datos
│
├── docs/
│   ├── flujo-autenticacion.md
│   ├── flujo-almacenamiento.md
│   ├── modelo-datos.md
│   ├── catalogo-eventos.md
│   └── elasticsearch-setup.md  # ✅ NUEVO: Documentación de Elasticsearch
│
├── .github/
│   └── workflows/
│       ├── ci-all.yml
│       ├── ci-contract.yml
│       ├── deploy-api-gateway.yml
│       ├── deploy-auth-service.yml
│       ├── deploy-catalog-service.yml
│       ├── deploy-university-service.yml
│       ├── deploy-user-service.yml
│       ├── deploy-request-service.yml
│       ├── deploy-booking-service.yml
│       ├── deploy-resource-service.yml
│       ├── deploy-event-service.yml
│       ├── deploy-notification-service.yml
│       ├── deploy-pqrs-service.yml
│       ├── deploy-storage-service.yml
│       └── README.md
│
├── .husky/
│   ├── pre-commit
│   └── commit-msg
│
├── .env.example
├── .eslintrc.js
├── .prettierrc
├── .gitignore
├── .nvmrc
├── jsconfig.json
├── turbo.json
├── package.json
├── README.md
└── SECURITY.md
```
