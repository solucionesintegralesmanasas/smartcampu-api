# Guía de Despliegue — SmartCampus API (`smartcampu-api`)

Este repositorio es un **monorepo Turborepo (`npm workspaces`)** con **12 microservicios** (`api-gateway` + 11 servicios de dominio) y **4 paquetes compartidos** (`packages/*`).

## Estructura del despliegue y dependencias

- **Punto de entrada público:** `api-gateway` (puerto `3000`, healthcheck `/health`).
- **Microservicios internos (puertos `3001`–`3011`, healthcheck `/healthz`):**
  - `auth-service` (`3001`, BD `uajs_auth`)
  - `user-service` (`3002`, BD `uajs_users`)
  - `catalog-service` (`3003`, BD `uajs_catalog`)
  - `university-service` (`3004`, BD `uajs_academic`)
  - `resource-service` (`3005`, BD `uajs_resources`)
  - `booking-service` (`3006`, BD `uajs_bookings`)
  - `request-service` (`3007`, BD `uajs_requests`)
  - `event-service` (`3008`, BD `uajs_events`)
  - `notification-service` (`3009`, BD `uajs_notifications`)
  - `pqrs-service` (`3010`, BD `uajs_pqrs`)
  - `storage-service` (`3011`, BD `uajs_storage`)
- **Infraestructura requerida:**
  - **MySQL 8.0** (una única instancia con las 11 bases de datos `uajs_*`, porque `auth-service`, `user-service` y `university-service` consultan esquemas cruzados).
  - **Redis 7** (caché y colas BullMQ).
  - **Elasticsearch 8.x** (opcional para búsqueda avanzada y bitácora de eventos; los servicios arrancan aunque no esté disponible).

## Secretos y variables de entorno requeridas

En producción, configure al menos los siguientes secretos (por ejemplo con `flyctl secrets set -a smartcampu-api ...`):

- **Seguridad (obligatorio en producción):**
  - `JWT_SECRET`: clave de al menos **64 caracteres** (compartida entre `api-gateway` y los microservicios).
  - `SERVICE_AUTH_TOKEN`: token de al menos **32 caracteres** para comunicación interna (`booking-service` -> `resource-service`).
  - `CORS_ALLOWED_ORIGINS`: URL del frontend en producción (ej. `https://smartcampus.solucionesintegralesmana.com`) o `*` para pruebas.
- **MySQL 8:**
  - `MYSQL_HOST`, `MYSQL_PORT` (`3306`), `MYSQL_USER`, `MYSQL_PASSWORD`.
  - El usuario de MySQL debe tener permisos (`ALL PRIVILEGES`) sobre las 11 bases: `uajs_catalog`, `uajs_auth`, `uajs_users`, `uajs_academic`, `uajs_resources`, `uajs_bookings`, `uajs_requests`, `uajs_events`, `uajs_notifications`, `uajs_pqrs`, `uajs_storage`.
- **Redis 7:**
  - `REDIS_HOST`, `REDIS_PORT` (`6379`) y opcionalmente `REDIS_PASSWORD`.
- **Elasticsearch 8 (opcional):**
  - `ELASTICSEARCH_HOST`, `ELASTICSEARCH_PORT` (`9200`), `ELASTICSEARCH_USER`, `ELASTICSEARCH_PASSWORD`.
- **Migración automática opcional:**
  - `AUTO_MIGRATE=true`: ejecuta `scripts/seed/run-all-seeds.js` en el arranque (requiere que el usuario MySQL tenga permisos para `CREATE DATABASE` y `CREATE TABLE`).

## Inicialización de la base de datos MySQL

Antes o durante el primer despliegue, cree las 11 bases de datos, tablas y datos iniciales ejecutando contra su instancia MySQL:

```bash
# Aplicar migraciones DDL en las 11 bases de datos
MYSQL_HOST=<host> MYSQL_PORT=3306 MYSQL_ROOT_USER=<usuario_admin> MYSQL_ROOT_PASSWORD=<clave> npm run db:migrate

# O ejecutar migraciones + seeders completos (usuarios, roles, catálogos y estados)
MYSQL_HOST=<host> MYSQL_PORT=3306 MYSQL_USER=<usuario_admin> MYSQL_PASSWORD=<clave> npm run db:seed
```

---

## Modalidades de despliegue

### Modalidad 1: App unificada en Fly.io o PaaS desde GitHub (por defecto)

Configuración lista en [Dockerfile](../Dockerfile), [fly.toml](../fly.toml) y [start-all.js](../scripts/start-all.js):

- Con `SERVICE_NAME=all`, un único contenedor levanta los 11 microservicios internos en `127.0.0.1:3001..3011` y expone `api-gateway` en el puerto `3000`.
- Es la opción recomendada para despliegues automáticos desde GitHub en Fly.io (`smartcampu-api`), Railway, Render o Coolify sin configurar 12 apps independientes.

```bash
flyctl secrets set -a smartcampu-api \
  JWT_SECRET="<minimo_64_caracteres>" \
  SERVICE_AUTH_TOKEN="<minimo_32_caracteres>" \
  MYSQL_HOST="<host_mysql>" MYSQL_PORT="3306" MYSQL_USER="<usuario>" MYSQL_PASSWORD="<clave>" \
  REDIS_HOST="<host_redis>" REDIS_PORT="6379" \
  CORS_ALLOWED_ORIGINS="https://smartcampus.solucionesintegralesmana.com"

flyctl deploy
```

### Modalidad 2: 12 apps independientes en Fly.io

Utiliza [fly.toml](../fly.toml) para `smartcampu-api` (`api-gateway`) y los 11 manifiestos de `infrastructure/fly/fly.<servicio>.toml`, comunicándose por la red privada `http://uajs-smartcampus-<servicio>.internal:<puerto>`:

1. Configurar los mismos secretos de entorno (`JWT_SECRET`, `SERVICE_AUTH_TOKEN`, `MYSQL_*`, `REDIS_*`) en cada una de las 12 apps.
2. Ejecutar desde la raíz del monorepo en PowerShell:

```powershell
.\scripts\deploy\fly-deploy-all.ps1
```

### Modalidad 3: Docker Compose en VPS o servidor propio

Ideal para levantar en un único servidor el stack completo (MySQL 8, Redis 7, Elasticsearch 8.12, Kibana y los 12 microservicios):

```bash
# Desde la raíz del monorepo
npm run docker:up
```

Para construir y levantar con un archivo `.env` en `infrastructure/docker/` o en la raíz, asegúrese de definir `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD`, `JWT_SECRET`, `SERVICE_AUTH_TOKEN` y `ELASTICSEARCH_PASSWORD`. En el primer arranque de MySQL, [init-databases.sh](../infrastructure/docker/init/init-databases.sh) crea automáticamente las 11 bases de datos y concede privilegios a `MYSQL_USER`.
