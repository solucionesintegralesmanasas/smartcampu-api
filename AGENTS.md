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
| university-service   | 3004 | Structure only        |
| user-service         | 3002 | Structure only        |
| resource-service     | 3005 | Structure only        |
| booking-service      | 3006 | Structure only        |
| request-service      | 3007 | Structure only        |
| event-service        | 3008 | Structure only        |
| notification-service | 3009 | Structure only        |
| pqrs-service         | 3010 | Structure only        |
| storage-service      | 3011 | Structure only        |

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
- Kubernetes manifests under `infrastructure/kubernetes/` (per-service deployments + ingress)
- Elasticsearch setup scripts: `scripts/elasticsearch/setup.js`

## Environment

- Each app has its own `.env` (gitignored) and `.env.example` (committed)
- Root `.env.example` documents all shared variables
- Key services depend on: MySQL, Redis, Elasticsearch — all configured via env vars
- `SERVICE_AUTH_TOKEN` is used for inter-service auth
- Each service proxies through the API Gateway via `http-proxy-middleware`
