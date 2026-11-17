# UAJS Smart Campus — API

Monorepo de microservicios para la plataforma **Smart Campus** de UAJS. Expone
una API REST mediante un **API Gateway** único y reparte la responsabilidad entre
**12 microservicios** en Node.js 20 + Express,
con **MySQL 8**, **Redis 7** (caché y colas BullMQ), **Elasticsearch 8** (búsqueda
y logs) y **Kibana** para observabilidad.

Este documento es la guía de **instalación, configuración, ejecución y
comprobación** del proyecto. Para el detalle de la base de datos (migraciones,
semillas y consultas de verificación) existe una guía específica:
[`docs/guia-inicializacion.md`](docs/guia-inicializacion.md).

**Última revisión:** 2026-10-24

## Contenido

- [Arquitectura](#arquitectura)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos previos](#requisitos-previos)
- [1. Instalación](#1-instalación)
- [2. Configuración](#2-configuración)
- [3. Ejecución](#3-ejecución)
- [4. Comprobación](#4-comprobación)
- [5. Comandos disponibles](#5-comandos-disponibles)
- [6. Limitaciones conocidas](#6-limitaciones-conocidas)
- [7. Documentación relacionada](#7-documentación-relacionada)
- [8. Seguridad y contribución](#8-seguridad-y-contribución)

## Arquitectura

```text
Cliente (web / móvil / REST Client / Postman)
                     │
                     ▼
        api-gateway :3000
  JWT · rate limit (token bucket) · X-Request-Id
  pathRewrite /api/v1/<español> → /api/v1/<inglés>
                     │
   ┌─────────┬───────┴────────┬──────────┐
   ▼         ▼                ▼          ▼
 auth      user           catalog   ... 11 servicios internos
 :3001     :3002          :3003         :3004 – :3011
   │         │                │
   └─────────┴────────────────┴──────────────────┐
                                                 ▼
        MySQL 8 (host :3307 / red Docker :3306)   uajs_* (10 bases)
        Redis 7 (:6379)                           caché + colas BullMQ
        Elasticsearch 8 (:9200) + Kibana (:5601)  búsqueda + logs
```

- El **gateway** valida el JWT, aplica rate limiting, propaga `X-Request-Id` y
  reescribe los prefijos públicos en español a las rutas internas en inglés.
- Los servicios se comunican entre sí con el secreto compartido
  `SERVICE_AUTH_TOKEN` (cabecera `X-Service-Token`); no confían en un JWT ajeno.
- Los servicios de reservas, solicitudes, eventos y PQRS publican eventos de
  dominio en la cola `notification_events`, consumida por
  `notification-service`.

## Estructura del repositorio

```text
smartcampu-api/
├── apps/                        # 12 microservicios (api-gateway + 11 servicios)
├── packages/                    # 4 paquetes compartidos
│   ├── shared-utils             # logger, crypto, respuestas, rate limiter
│   ├── database-client          # pool MySQL + cliente Redis
│   ├── shared-types             # tipos compartidos (JS)
│   └── shared-elasticsearch     # cliente ES, mapeos y consultas
├── infrastructure/
│   ├── docker/                  # docker-compose.yml, Dockerfile.base, init/
│   └── kubernetes/              # manifiestos de despliegue
├── scripts/
│   ├── migrations/              # 10 esquemas SQL (uno por base)
│   ├── seed/                    # 8 semillas de catálogos y estados
│   └── elasticsearch/           # setup de índices
├── tests/http/                  # colección REST Client (integración)
├── docs/                        # guías, diagramas y diccionario de datos
├── .env.example                 # plantilla de variables del proyecto
└── package.json                 # raíz del monorepo (Turborepo + workspaces)
```

## Requisitos previos

| Herramienta                     | Versión mínima | Cómo verificar             |
| ------------------------------- | -------------- | -------------------------- |
| Node.js                         | 20.x           | `node -v`                  |
| npm                             | 10.x           | `npm -v`                   |
| Docker Engine + Compose v2      | 20.10 / 2.0    | `docker --version`         |
| Git                             | reciente       | `git --version`            |
| Git Bash o WSL (recomendado)    | —              | `bash --version`           |
| RAM libre para Elasticsearch    | ~2 GB          | Docker Desktop → Resources |
| VS Code + extensión REST Client | opcional       | Para `tests/http/*.http`   |

> En Windows conviene usar **Git Bash** para los comandos de esta guía: la
> redirección `<` y los bucles de los ejemplos no funcionan igual en PowerShell.
> Si usas PowerShell, emplea `curl.exe` (no el alias `curl` de
> `Invoke-WebRequest`).

## 1. Instalación

Desde la raíz del repositorio:

```bash
npm install
```

Esto instala las dependencias de los 12 servicios y de los 4 paquetes
compartidos mediante workspaces. Al final se configura el hook de Husky
(pre-commit y commit-msg), porque el repositorio incluye `.git`.

No hay paso de compilación: el proyecto es JavaScript CommonJS. `npm run build`
existe en la raíz por compatibilidad con Turborepo, pero ningún workspace define
hoy una tarea `build`, por lo que no genera artefactos.

## 2. Configuración

Hay **dos niveles** de configuración:

1. Un `.env` para **Docker Compose** (`infrastructure/docker/.env`).
2. Un `.env` por **servicio** (`apps/<servicio>/.env`), solo si se ejecutan con
   Node directamente en el host.

Las plantillas canónicas son `.env.example` (raíz) y
`apps/<servicio>/.env.example`.

### 2.1 Archivo `.env` de Docker Compose

Docker Compose lee automáticamente el `.env` ubicado junto a
`infrastructure/docker/docker-compose.yml`. Créalo con:

```env
MYSQL_ROOT_PASSWORD=uajs206**
MYSQL_USER=uajs_user
MYSQL_PASSWORD=uajs206**
JWT_SECRET=uajs_dev_jwt_secret_1234567890abcdefghijklmnopqrstuvwxyz_extra_long_654321
JWT_ACCESS_SECRET=uajs_dev_jwt_access_secret_abcdefghijklmnopqrstuvwxyz_0123456789_extra
JWT_REFRESH_SECRET=uajs_dev_jwt_refresh_secret_abcdefghijklmnopqrstuvwxyz_9876543210_largo
SERVICE_AUTH_TOKEN=uajs_service_token_2024_change_me_in_prod
ELASTICSEARCH_PASSWORD=changeme
```

Estos valores son **solo para desarrollo**. En cualquier entorno compartido
cámbialos y no los confirmes en Git.

### 2.2 Archivo `.env` por servicio (ejecución sin Docker)

Copia cada plantilla y ajusta los hosts al entorno local:

```bash
# Bash (Git Bash o WSL)
for d in apps/*/; do
  [ -f "$d.env.example" ] && cp "$d.env.example" "$d.env"
done
```

```powershell
# PowerShell
Get-ChildItem apps -Directory | ForEach-Object {
  $src = Join-Path $_.FullName '.env.example'
  if (Test-Path $src) { Copy-Item $src (Join-Path $_.FullName '.env') }
}
```

Las plantillas apuntan a los **nombres de contenedor** (`mysql`, `redis`,
`elasticsearch`). Para ejecutar los servicios con Node en el host, cambia:

| Variable             | Dentro de Docker             | En el host (Node local)     |
| -------------------- | ---------------------------- | --------------------------- |
| `MYSQL_HOST`         | `mysql`                      | `localhost`                 |
| `MYSQL_PORT`         | `3306`                       | `3307` (puerto publicado)   |
| `REDIS_HOST`         | `redis`                      | `localhost`                 |
| `ELASTICSEARCH_HOST` | `elasticsearch`              | `localhost`                 |
| `SERVICE_*_URL`      | `http://<servicio>:<puerto>` | `http://localhost:<puerto>` |

En el gateway, las 11 variables `SERVICE_*_URL` deben apuntar a
`http://localhost:3001` … `http://localhost:3011`.

### 2.3 Reglas de secretos

| Variable                 | Longitud mínima | Debe coincidir en                           |
| ------------------------ | --------------- | ------------------------------------------- |
| `JWT_SECRET`             | 64 caracteres   | `api-gateway` y `auth-service`              |
| `JWT_REFRESH_SECRET`     | 64 caracteres   | `auth-service`                              |
| `SERVICE_AUTH_TOKEN`     | 32 caracteres   | Todos los servicios y el gateway            |
| `ELASTICSEARCH_PASSWORD` | 8 caracteres    | Elasticsearch, Kibana y todos los servicios |

- `auth-service` rechaza al arrancar un `JWT_SECRET` o `JWT_REFRESH_SECRET` de
  menos de 64 caracteres; el gateway acepta desde 32, así que usa **64** para
  evitar que solo uno de los dos arranque.
- Si el `JWT_SECRET` del gateway y el de `auth-service` difieren, el login
  funciona pero **toda** petición autenticada falla con `401 invalid signature`.
- Para generar secretos nuevos:

  ```bash
  npm run generate:secrets
  ```

  El script escribe `.env.secrets` en la raíz (no lo confirmes en Git) con
  `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `SERVICE_AUTH_TOKEN`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`,
  `REDIS_PASSWORD` y `ELASTICSEARCH_PASSWORD`.

### 2.4 Validación de las plantillas

```bash
npm run validate:env
```

Salida esperada:

```text
  .env.example es valido
  .env.development: no existe, se omite
  .env.staging: no existe, se omite
  .env.production: no existe, se omite
Todos los archivos de entorno son validos
```

El validador revisa la plantilla de la raíz y los entornos `.env.development`,
`.env.staging` y `.env.production` si existen. Exige `SERVICE_AUTH_TOKEN` de 32+
caracteres, `ELASTICSEARCH_PASSWORD` de 8+ y un esquema JWT válido
(`JWT_SECRET` o el par `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET`, de 32+
caracteres cada uno).

## 3. Ejecución

### 3.1 Opción A — Todo con Docker (recomendada)

```bash
npm run docker:up
```

Levanta MySQL, Redis, Elasticsearch, Kibana y los 12 servicios con `nodemon`
(hot reload). La primera ejecución construye la imagen compartida `uajs-base`,
que instala todas las dependencias; puede tardar varios minutos.

Verifica el estado y sigue los logs:

```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
npm run docker:logs
```

Detén el entorno:

```bash
npm run docker:down            # conserva los volúmenes (datos)
docker compose -f infrastructure/docker/docker-compose.yml down -v   # borra los datos
```

> **Puerto de MySQL:** dentro de la red Docker es `mysql:3306`; desde el host se
> publica en `127.0.0.1:3307`. Usa `3307` con cualquier cliente externo.

### 3.2 Opción B — Infraestructura en Docker y servicios con Node

Útil para depurar un servicio con el depurador de VS Code:

```bash
# 1. Solo infraestructura
docker compose -f infrastructure/docker/docker-compose.yml up -d mysql redis elasticsearch

# 2. Servicios en el host (con sus .env ya ajustados, ver 2.2)
npm run dev
```

Para arrancar un único servicio:

```bash
npm run dev -w auth-service          # apps/auth-service
npm run dev -w @uajs/api-gateway     # apps/api-gateway (nombre con scope)
```

En este modo, el gateway (`:3000`) espera a los servicios en `localhost`, no en
los nombres de contenedor.

### 3.3 Migraciones y datos semilla

En un **volumen nuevo**, el contenedor de MySQL aplica automáticamente las 10
migraciones de `scripts/migrations/` mediante
`infrastructure/docker/init/init-databases.sh`. Si el volumen `mysql_data` ya
existía, ese script **no se vuelve a ejecutar** y hay que aplicar las
migraciones y las semillas manualmente.

Orden obligatorio de las semillas:

1. `ms-catalog_001_seed.sql`
2. `ms-auth_001_seed.sql`
3. `ms-academic_001_seed.sql` (depende de `uajs_catalog.cities`)
4. `ms-resources_001_seed.sql`
5. `ms-bookings_001_seed.sql`
6. `ms-requests_001_seed.sql`
7. `ms-events_001_seed.sql`
8. `ms-pqrs_001_seed.sql`

No hay semillas para `uajs_notifications` ni `uajs_storage`. Todas son
idempotentes. Los comandos completos (Bash y PowerShell), la verificación de
conteos y la solución de problemas están en
[`docs/guia-inicializacion.md`](docs/guia-inicializacion.md).

> **Sin semillas no se puede crear nada** en reservas, solicitudes, eventos ni
> PQRS: esos servicios buscan un estado inicial (`pending`, `draft`, etc.) y
> responden `404` si no existe.

### 3.4 Índices de Elasticsearch

Los servicios crean sus índices bajo demanda, pero puedes prepararlos todos:

```bash
npm run es:status   # estado de los índices
npm run es:setup    # crea los índices y mapeos que falten
```

Credenciales por defecto: `elastic` / `changeme` (configurables con
`ELASTICSEARCH_*`). Kibana queda en <http://localhost:5601>.

## 4. Comprobación

### 4.1 Infraestructura

```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
docker exec uajs-redis redis-cli ping
curl -u elastic:changeme http://localhost:9200/_cluster/health?pretty
```

Resultados esperados: `uajs-mysql`, `uajs-redis` y `uajs-elasticsearch` en
estado `(healthy)`, `PONG` y un `status` `green` o `yellow`.

### 4.2 Servicios: health checks

| Servicio             | URL de health                                       | Esperado |
| -------------------- | --------------------------------------------------- | -------- |
| api-gateway          | `http://localhost:3000/health/liveness`             | `200`    |
| api-gateway          | `http://localhost:3000/health/readiness`            | `200`\*  |
| auth-service         | `http://localhost:3001/healthz`                     | `200`    |
| user-service         | `http://localhost:3002/api/v1/users/health`         | `200`    |
| catalog-service      | `http://localhost:3003/api/v1/catalog/health`       | `200`    |
| university-service   | `http://localhost:3004/api/v1/university/health`    | `200`    |
| resource-service     | `http://localhost:3005/api/v1/resources/health`     | `200`    |
| booking-service      | `http://localhost:3006/api/v1/bookings/health`      | `200`    |
| request-service      | `http://localhost:3007/api/v1/requests/health`      | `200`    |
| event-service        | `http://localhost:3008/api/v1/events/health`        | `200`    |
| notification-service | `http://localhost:3009/api/v1/notifications/health` | `200`    |
| pqrs-service         | `http://localhost:3010/api/v1/pqrs/health`          | `200`    |
| storage-service      | `http://localhost:3011/api/v1/storage/health`       | `200`    |

\*`/health/liveness` solo comprueba el proceso del gateway; `/health/readiness`
devuelve `503` si alguna dependencia (servicios, MySQL, Redis o Elasticsearch)
no responde.

Comprobación rápida de todos (Bash):

```bash
for url in \
  http://localhost:3000/health/liveness \
  http://localhost:3000/health/readiness \
  http://localhost:3001/healthz \
  http://localhost:3002/api/v1/users/health \
  http://localhost:3003/api/v1/catalog/health \
  http://localhost:3004/api/v1/university/health \
  http://localhost:3005/api/v1/resources/health \
  http://localhost:3006/api/v1/bookings/health \
  http://localhost:3007/api/v1/requests/health \
  http://localhost:3008/api/v1/events/health \
  http://localhost:3009/api/v1/notifications/health \
  http://localhost:3010/api/v1/pqrs/health \
  http://localhost:3011/api/v1/storage/health; do
  printf '%s -> ' "$url"
  curl -s -o /dev/null -w '%{http_code}\n' "$url"
done
```

### 4.3 Flujo funcional completo por el gateway

Las rutas públicas son `POST /api/v1/auth/register` y `POST /api/v1/auth/login`.
El resto exige `Authorization: Bearer <accessToken>`.

**1) Registrar un usuario** (ruta pública):

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "prueba@uajs.edu",
    "password": "Prueba.2026",
    "firstName": "Prueba",
    "lastName": "QA",
    "documentTypeCode": "CC",
    "documentNumber": "1020304050"
  }'
```

Respuesta esperada: `201` con `{ "success": true, "data": { "id", "uuid", ... } }`.

**2) Iniciar sesión**:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{ "email": "prueba@uajs.edu", "password": "Prueba.2026" }'
```

Copia el valor de `data.accessToken` de la respuesta.

**3) Consultar una ruta protegida**:

```bash
TOKEN="<accessToken del paso 2>"

curl -s http://localhost:3000/api/v1/universidad/sedes \
  -H "Authorization: Bearer $TOKEN"
```

**4) Probar una ruta de administración.** El registro asigna el rol `STUDENT`.
Para acceder a `/api/v1/usuarios/...` con permisos de administración, otorga el
rol `SUPERADMIN` (id `1` en las semillas) y vuelve a iniciar sesión:

```sql
INSERT IGNORE INTO uajs_auth.user_roles (user_id, role_id)
SELECT id, 1 FROM uajs_auth.users WHERE email = 'prueba@uajs.edu';
```

```bash
curl -s http://localhost:3000/api/v1/usuarios/usuarios/1 \
  -H "Authorization: Bearer $TOKEN"
```

Negativos que deben fallar: sin token → `401`; ruta inexistente → `404`;
cuerpo inválido → `400`; exceso de peticiones → `429` con `Retry-After`.

### 4.4 Base de datos

Estas consultas (en la consola de MySQL del contenedor) confirman que el
esquema y las semillas están completos:

```sql
SHOW DATABASES LIKE 'uajs\_%';                 -- 11 filas (10 bases + uajs_smart_campus)
SELECT COUNT(*) FROM uajs_auth.roles;          -- 5
SELECT COUNT(*) FROM uajs_catalog.cities;      -- 136
SELECT COUNT(*) FROM uajs_academic.campuses;   -- 1
```

Comprueba la integridad sede → ciudad (debe devolver `0`):

```sql
SELECT COUNT(*) AS campus_sin_ciudad
FROM uajs_academic.campuses c
WHERE NOT EXISTS (SELECT 1 FROM uajs_catalog.cities ci WHERE ci.uuid = c.city_uuid);
```

El detalle de tablas por base (54 en total), conteos de cada semilla, permisos
del usuario `uajs_user` y lista de verificación completa está en
[`docs/guia-inicializacion.md`](docs/guia-inicializacion.md).

### 4.5 Pruebas automatizadas y calidad

```bash
npm test                 # Jest en todos los workspaces (unit + e2e)
npm run test:watch       # Jest en modo watch
npm run lint             # ESLint (airbnb-base)
npm run lint:fix         # ESLint con --fix
npm run format:check     # Prettier
npm run format           # Prettier --write
```

Para un servicio concreto:

```bash
cd apps/auth-service
npm run test:unit
npm run test:e2e
npm run lint
```

Notas:

- Los tests unitarios no necesitan infraestructura; los `e2e` que tocan
  MySQL/Redis/Elasticsearch sí. `tests/setup.js` de cada servicio precarga
  variables de entorno (por defecto `localhost:3306`); si usas el MySQL de
  Docker, exporta `MYSQL_PORT=3307` antes de ejecutarlos.
- La integración continua (`.github/workflows/ci.yml`) ejecuta `npm run lint` y
  `npm run test` con MySQL, Redis y Elasticsearch como servicios, aplicando
  todas las migraciones y semillas antes de las pruebas.

### 4.6 Colección de integración (REST Client)

`tests/http/` contiene una colección ejecutable desde VS Code:

| Archivo                  | Qué demuestra                                                   |
| ------------------------ | --------------------------------------------------------------- |
| `01-gateway.http`        | Recorrido completo por el gateway: login y los 11 servicios     |
| `02-inter-servicio.http` | Llamadas directas entre servicios, `X-Service-Token` y rechazos |

Sigue las instrucciones de [`tests/http/README.md`](tests/http/README.md):
primero el login, después los bloques en orden. Cada servicio conserva además
su propia colección en `apps/<servicio>/tests/*.http`.

### 4.7 Lista de verificación final

| #   | Comprobación                              | Resultado esperado               | Hecho |
| --- | ----------------------------------------- | -------------------------------- | ----- |
| 1   | `npm install`                             | Sin errores                      | ☐     |
| 2   | `npm run validate:env`                    | "Todos los archivos ... validos" | ☐     |
| 3   | `docker compose ... ps`                   | MySQL, Redis y ES `healthy`      | ☐     |
| 4   | `redis-cli ping`                          | `PONG`                           | ☐     |
| 5   | `SHOW DATABASES LIKE 'uajs\_%'`           | 11 filas                         | ☐     |
| 6   | Semillas aplicadas                        | Conteos de la guía               | ☐     |
| 7   | Health de los 12 servicios                | Todos `200`                      | ☐     |
| 8   | Registro + login por el gateway           | `201` y `200` con tokens         | ☐     |
| 9   | Consulta protegida (`/universidad/sedes`) | `200` con datos                  | ☐     |
| 10  | `npm run lint` y `npm test`               | Sin errores                      | ☐     |

## 5. Comandos disponibles

Todos se ejecutan desde la raíz del repositorio.

| Comando                    | Qué hace                                                          |
| -------------------------- | ----------------------------------------------------------------- |
| `npm run dev`              | Arranca los 12 servicios con Turborepo (requiere infraestructura) |
| `npm test`                 | Ejecuta los tests de todos los workspaces                         |
| `npm run test:watch`       | Tests en modo watch                                               |
| `npm run lint`             | ESLint en apps y packages                                         |
| `npm run lint:fix`         | ESLint con corrección automática                                  |
| `npm run format`           | Prettier sobre JS, JSON, Markdown, YAML                           |
| `npm run format:check`     | Verifica el formato sin modificar archivos                        |
| `npm run build`            | Tarea Turborepo de build (hoy sin workspaces que la definan)      |
| `npm run docker:up`        | Levanta infraestructura + servicios en Docker                     |
| `npm run docker:down`      | Detiene los contenedores (conserva volúmenes)                     |
| `npm run docker:logs`      | Sigue los logs de todos los contenedores                          |
| `npm run es:status`        | Estado de los índices de Elasticsearch                            |
| `npm run es:setup`         | Crea índices y mapeos de Elasticsearch                            |
| `npm run validate:env`     | Valida las plantillas y archivos de entorno                       |
| `npm run generate:secrets` | Genera `.env.secrets` con secretos aleatorios                     |
| `npm run clean`            | Limpia cachés de Turborepo y `node_modules`                       |

## 6. Limitaciones conocidas

| Tema                             | Comportamiento actual                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/v1/auth/refresh`      | No está en las rutas públicas del gateway: hay que enviar `Authorization` incluso con el access token caducado.          |
| `GET /api/v1/catalogos/campuses` | Responde `500` por una tabla `uajs_catalog.sedes` inexistente. Usa `/api/v1/universidad/sedes` como fuente de sedes.     |
| Búsqueda de usuarios             | Usa Elasticsearch; un usuario recién registrado no aparece hasta que se indexa.                                          |
| Elasticsearch caído              | Las llamadas fallan rápido (~2 s) por el circuit breaker; no bloquean la petición HTTP.                                  |
| Notificaciones                   | Son asíncronas (BullMQ). Se verifican en `docker logs` y en `uajs_notifications.notifications`, no en la respuesta HTTP. |
| `catalog-service`                | Implementación parcial (el resto de servicios está completo).                                                            |

## 7. Documentación relacionada

| Documento                                                                    | Contenido                                                            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`docs/guia-inicializacion.md`](docs/guia-inicializacion.md)                 | Migraciones, semillas, verificación y solución de problemas de la BD |
| [`docs/elasticsearch-setup.md`](docs/elasticsearch-setup.md)                 | Índices, mapeos, Kibana y credenciales                               |
| [`docs/matriz-propiedad-datos.md`](docs/matriz-propiedad-datos.md)           | Qué servicio es dueño de qué datos                                   |
| [`docs/diccionario-de-datos.md`](docs/diccionario-de-datos.md)               | Diccionario de tablas y campos                                       |
| [`docs/diagrama-er.md`](docs/diagrama-er.md)                                 | Diagrama entidad-relación                                            |
| [`tests/http/README.md`](tests/http/README.md)                               | Colección de integración con REST Client                             |
| [`infrastructure/docker/README.md`](infrastructure/docker/README.md)         | Referencia de Docker Compose (revisar notas de la guía)              |
| [`infrastructure/kubernetes/README.md`](infrastructure/kubernetes/README.md) | Despliegue en Kubernetes                                             |
| [`SECURITY.md`](SECURITY.md)                                                 | Política de seguridad                                                |
| [`apps/`](apps/)                                                             | README propio de cada microservicio                                  |

## 8. Seguridad y contribución

- No confirmes `.env`, `.env.secrets` ni credenciales reales. Usa las
  plantillas `.env.example` y rota los secretos en cada entorno.
- Los commits siguen **Conventional Commits** (commitlint). Tipos permitidos:
  `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`,
  `style`, `revert`. Scopes: `gateway`, `auth`, `users`, `catalog`, `university`,
  `resources`, `bookings`, `requests`, `events`, `notifications`, `pqrs`,
  `storage`. El encabezado admite hasta 72 caracteres.
- El pre-commit ejecuta Prettier y ESLint sobre los archivos modificados; el
  commit-msg valida el mensaje.
- Reporta vulnerabilidades según lo indicado en [`SECURITY.md`](SECURITY.md).
