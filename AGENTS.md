# AGENTS.md

## Regla de Idioma Obligatoria / Language Rule

> [!IMPORTANT]
> **Todas las respuestas, interacciones, comentarios de código y explicaciones proporcionadas por los agentes de IA en este repositorio deben ser única y exclusivamente en ESPAÑOL.** Nada de inglés en las respuestas.

## Quick reference

```bash
npm run dev            # Start all 12 services via Turborepo
npm run build          # Build all packages (dependencies first)
npm run test           # Run all tests
npm run lint           # Lint all apps/packages
npm run lint:fix       # Auto-fix lint issues
npm run format         # Prettier write
npm run format:check   # Prettier check
npm run docker:up      # Start MySQL 8 + Redis 7 + Elasticsearch 8 + Kibana
npm run docker:down    # Stop infrastructure
npm run es:status      # Check Elasticsearch health
npm run validate:env   # Validate .env files
```

Run a single service (e.g. auth-service):

```bash
cd apps/auth-service && npm run dev
```

Run tests for one service:

```bash
cd apps/auth-service && npm run test:unit
cd apps/auth-service && npm run test:e2e
```

## Monorepo structure

- **Turborepo** with npm workspaces (`apps/*`, `packages/*`)
- Node >= 20, CommonJS (`"type": "commonjs"`), no TypeScript (plain JS + jsconfig)
- Path aliases in `jsconfig.json`: `@apps/*`, `@packages/*`, `@shared-types`, `@shared-utils`, `@database-client`

### 12 microservices (`apps/`)

| Service              | Port | Status                |
| -------------------- | ---- | --------------------- |
| api-gateway          | 3000 | Implemented           |
| auth-service         | 3001 | Implemented           |
| catalog-service      | 3003 | Partially implemented |
| university-service   | 3004 | Implemented (own MySQL database `uajs_academic`) |
| user-service         | 3002 | Implemented (shares auth-service's MySQL database — see `apps/user-service/README.md`) |
| resource-service     | 3005 | Implemented (own MySQL database `uajs_resources`) |
| booking-service      | 3006 | Implemented (own MySQL database `uajs_bookings`, llama a resource-service) |
| request-service      | 3007 | Implemented (own MySQL database `uajs_requests`, llama a storage-service) |
| event-service        | 3008 | Implemented (own MySQL database `uajs_events`, inscripciones con lista de espera) |
| notification-service | 3009 | Implemented (own MySQL database `uajs_notifications`, consume eventos de dominio de booking/request/event/pqrs) |
| pqrs-service         | 3010 | Implemented (own MySQL database `uajs_pqrs`, radicación anónima, llama a storage-service) |
| storage-service      | 3011 | Implemented (own MySQL database `uajs_storage`, driver local en disco) |

Most services under `apps/` are **empty scaffolds** (directory structure only, no real code). Verify before editing.

### 4 shared packages (`packages/`)

- `@uajs/shared-utils` — logger, crypto, response helpers, constants, rate limiter
- `@uajs/database-client` — MySQL pool + Redis client wrappers
- `@uajs/shared-types` — shared type definitions (plain JS)
- `@uajs/shared-elasticsearch` — ES client, mappings, queries

Internal deps use `file:` protocol: `"@uajs/shared-utils": "file:../../packages/shared-utils"`

## Service architecture pattern

Every implemented service follows the same internal layout:

```
src/
  config/         env.js, logger.js, elasticsearch.js, database/{mysql,redis}.js, queues.js
  core/           exceptions/{AppError, NotFoundError, ...}, loaders/{express,database}.js
  modules/<name>/ <name>.{controller,service,repository,validation,routes}.js
  jobs/           producers/ + consumers/ (BullMQ queues)
  docs/           swagger.yaml + swagger.config.js
  app.js          Express app setup
  server.js       Entry point, graceful shutdown
```

Module pattern: **controller -> service -> repository** (layered architecture). Validation via Zod.

## Testing

- **Jest** with `--runInBand` (serial execution per service)
- Test dirs: `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/fixtures/`
- Tests have a **setup file** (e.g. `tests/setup.js`) that pre-fills `process.env` with test defaults — loaded via `jest.config.js` `setupFiles` to avoid Zod validation failing during import
- Services with queues use **BullMQ** + Redis — integration/e2e tests need Redis running

## Linting & formatting

- ESLint with **airbnb-base** (root `.eslintrc.js`)
- Prettier: single quotes, semicolons, 100-char lines, trailing commas, LF line endings
- **lint-staged** runs on pre-commit: prettier + eslint --fix on `*.{js,json,md,yaml,yml}`
- Husky hooks: `pre-commit` (lint-staged), `commit-msg` (commitlint)

### ESLint gotchas

- `packages/` directory has **relaxed rules** (no-console off, no-import-order off, max-len off, etc.)
- Test files relax: `no-unused-expressions`, `max-len`, `global-require`
- `import/order` is enforced in apps: builtin -> external -> internal -> parent -> sibling -> index, with newlines between groups

## Commit conventions

Conventional commits enforced via commitlint:

- **Types**: feat, fix, refactor, perf, test, docs, build, ci, chore, style, revert
- **Scopes** (enforced): gateway, auth, users, catalog, university, resources, bookings, requests, events, notifications, pqrs, storage
- Header max 72 chars, body line max 100 chars

## Infrastructure

- Docker Compose at `infrastructure/docker/docker-compose.yml` — MySQL 8 (port 3307 externally), Redis 7 (6379), Elasticsearch 8.12 (9200), Kibana (5601)
- Base Docker image: `node:20-alpine` with python3/make/g++ for native modules (bcrypt)
- Kubernetes manifests under `infrastructure/kubernetes/` (namespace, configmap, secrets template, MySQL/Redis/Elasticsearch as single-pod Deployments, one Deployment+Service per app service, ingress) — see `infrastructure/kubernetes/README.md` for the apply order and the "single shared `uajs-base` image" pattern
- CI at `.github/workflows/ci.yml` — one workflow (not one per service): a `lint` job running `npm run lint` across every workspace, and a `test` job that spins up MySQL/Redis/Elasticsearch as GitHub Actions `services:`, applies every `scripts/migrations/*.sql` + `scripts/seed/*.sql`, then runs `npm run test`
- Elasticsearch setup scripts: `scripts/elasticsearch/setup.js` (create/status/delete all 12 indices+mappings from `@uajs/shared-elasticsearch`)
- Seed data at `scripts/seed/ms-*_001_seed.sql` — one per service with catalog/status tables (auth, catalog, academic, bookings, requests, events, pqrs, resources). **These aren't optional**: `booking-service`/`request-service`/`event-service`/`pqrs-service`'s `create()` flow looks up an initial status by code (e.g. `'pending'`) and throws `NotFoundError` if it isn't seeded — a fresh database with no seeds can't create anything through those 4 services. Seeds are idempotent (`ON DUPLICATE KEY UPDATE`); `ms-academic_001_seed.sql` cross-references `uajs_catalog.cities` by `dane_code` via a same-server subquery, so it must run after `ms-catalog_001_seed.sql`.
- `npm run test` / `npm run lint` at the root only actually traverse a workspace if that workspace's own `package.json` has a `test`/`lint` script matching Turborepo's pipeline task name in `turbo.json` — every app now has both (`"test": "jest tests/unit tests/e2e --passWithNoTests"`, `"lint": "eslint src/ tests/ jest.config.js"`); if you scaffold a new service, copy these two scripts too or `npm test`/`npm run lint` will silently skip it.
- Every service's `NODE_ENV` Zod enum must include `'test'` (not just `development`/`staging`/`production`) — Jest sets `process.env.NODE_ENV = 'test'` automatically, and without it any test that imports the real `config/env.js` (not a mocked one) fails at import time with a Zod validation error.

## Environment

- Each app has its own `.env` (gitignored) and `.env.example` (committed)
- Root `.env.example` documents all shared variables
- Key services depend on: MySQL, Redis, Elasticsearch — all configured via env vars
- `SERVICE_AUTH_TOKEN` is used for inter-service auth
- Each service proxies through the API Gateway via `http-proxy-middleware`
- **Important**: the gateway's public prefixes are in Spanish (`/api/v1/usuarios`,
  `/api/v1/eventos`, ...) but every service mounts its routes internally in
  English (`/api/v1/users`, `/api/v1/events`, ...). `http-proxy-middleware`
  forwards `req.originalUrl` unchanged when mounted via `app.use(path, mw)` —
  it does **not** strip the mount prefix — so `proxy.middleware.js`'s
  `SERVICE_MAP` must carry an explicit `pathRewrite` per service. If you add a
  new service to the gateway, add its `internalPath` there too or every
  request to it will 404 against the wrong route.
- **Notifications**: `booking-service`, `request-service`, `event-service`
  and `pqrs-service` each have their own `src/jobs/producers/notification.producer.js`
  that publishes to a queue named by `NOTIFICATION_QUEUE` (default
  `notification_events`) — the SAME queue `notification-service` listens on.
  This is intentional: BullMQ workers on a queue are competing consumers, not
  pub/sub, so a service's own audit queue (`booking_events`, etc.) can only
  ever have ONE consumer — its own `*.consumer.js`. Never point
  `notification-service` at another service's audit queue, and never reuse a
  service's own audit-queue name for notification events. See
  `apps/notification-service/README.md` and
  `src/jobs/consumers/domain-events.consumer.js` (`EVENT_DEFINITIONS`) for
  the full domain-event map.
- **BullMQ producers called synchronously from a request path must have a
  bounded timeout.** A BullMQ `Queue`'s underlying Redis connection retries
  indefinitely (never rejects) when Redis is unreachable — every `notify()`
  in the 4 notification producers above races the real `queue.add()` against
  a 2s timeout so a Redis outage can never hang the HTTP request that
  triggered it (confirmed by an end-to-end reproduction during Fase 9:
  without the timeout, `POST /api/v1/pqrs` hung forever with Redis down,
  `await`ing a promise that would never settle). Any new producer called
  synchronously from a request path must follow the same pattern — see
  `apps/*/src/jobs/producers/notification.producer.js`.
- `packages/shared-elasticsearch`'s `ElasticsearchClient#createIndex` called
  `this.indices.exists(...)` (undefined — only `this.client.indices` exists);
  fixed to `this.client.indices.exists(...)`. `scripts/elasticsearch/setup.js`
  had the identical bug in `status()`/`deleteAll()` (`client.cat`/`client.indices`
  instead of `client.client.cat`/`client.client.indices`). Both were dead
  code paths until Fase 9 actually ran `es:setup`/`es:status` for the first
  time — grep for `\.indices\.` / `\.cat\.` on any *new* code that touches
  an `ElasticsearchClient` instance directly (not through a service's own
  `ensureXIndex`, which already does this correctly) and make sure it's not
  the wrapper's own `this.indices`/`this.cat` (don't exist) but `this.client.indices`/`this.client.cat`.
- **`proxy.middleware.js`'s `onProxyReq` must call `fixRequestBody(proxyReq, req)`
  LAST, after every `proxyReq.setHeader(...)` call.** `express.json()` (mounted
  before the proxy in `app.js`) already consumed the original request stream
  to build `req.body`; without `fixRequestBody`, `http-proxy-middleware`
  forwards that now-empty stream but keeps the original `Content-Length`, so
  the internal service waits forever for a body that never arrives and the
  socket eventually resets (`[HPM] ECONNRESET: socket hang up`) — this meant
  **no POST/PUT/PATCH had ever worked through the gateway**, undetected
  because every prior phase only tested each service standalone on its own
  port. `fixRequestBody` calls `proxyReq.end(body)` immediately, so any
  header set *after* it is silently dropped — that's why it must run last,
  not first (a first attempt at this fix put it first and broke
  `X-User-Id`/`X-User-Roles`/`X-Service-Token` propagation on every POST
  while leaving GET unaffected, an inconsistency only visible by testing
  both methods through the real gateway).
- **`AuthService#login`/`#refreshToken` (auth-service) must sign a `roles`
  array claim, not just `rol` (singular).** `api-gateway`'s `auth.middleware.js`
  rejects any JWT where `Array.isArray(payload.roles)` is false — so a JWT
  with only `rol: 'STUDENT'` (a string) fails gateway auth with 401 even
  though it's perfectly valid and freshly issued, meaning no token from
  auth-service could ever authenticate a gateway-proxied request. `rol` is
  kept for backward compatibility with the rest of the payload; `roles` is
  what the gateway actually checks.
- **Any `await esClient.<method>(...)` in a synchronous request path needs a
  bound, same as the BullMQ producers above.** Found live in both
  `AuthService#logAuthEvent` (auth-service) and `SolicitudService#indexEntity`/
  `#notifyRecipient` (request-service, and very likely the equivalent method
  in booking/event/pqrs-service — not yet audited one by one). Rather than
  patching every call site, `packages/shared-elasticsearch/src/client.js`
  now decouples the circuit breaker's `timeout` (new `circuitBreakerTimeout`
  option, default 2000ms) from the raw ES client's `requestTimeout` (still
  30000ms, so legitimately slow queries against a healthy ES cluster aren't
  penalized) — every `esClient.<method>()` call in any of the 12 services
  now fails fast when Elasticsearch is unreachable instead of hanging up to
  30s. Confirmed end-to-end: `POST /api/v1/auth/login` went from ~9.6s to
  ~2s, `POST /api/v1/solicitudes/solicitudes` from a client-timeout hang to
  ~4s, both with Elasticsearch down.
