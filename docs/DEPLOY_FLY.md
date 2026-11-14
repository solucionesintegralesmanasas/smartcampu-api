# Despliegue de los 12 microservicios en Fly.io

Este repositorio es un **monorepo Turborepo**, por lo que `flyctl launch` desde la raíz fallaba al no encontrar un `Dockerfile` en la raíz ni una aplicación única.

## Solución implementada

- [Dockerfile](file:///C:/xampp/htdocs/uajs-smart-campus-scrip/smartcampu-api/Dockerfile) unificado en la raíz (parametrizado con `ARG SERVICE_NAME`, `ARG PORT` y `ARG HEALTH_PATH`).
- [fly.toml](file:///C:/xampp/htdocs/uajs-smart-campus-scrip/smartcampu-api/fly.toml) en la raíz para `api-gateway` (puerto `3000`, healthcheck `/health`).
- Archivos `infrastructure/fly/fly.<servicio>.toml` para los 11 microservicios restantes (puertos `3001`–`3011`, healthcheck `/healthz`).
- Script [fly-deploy-all.ps1](file:///C:/xampp/htdocs/uajs-smart-campus-scrip/smartcampu-api/scripts/deploy/fly-deploy-all.ps1) para crear y desplegar las 12 apps en Fly.io desde la raíz.

## Requisitos previos antes de desplegar

1. Instalar `flyctl` e iniciar sesión:
   ```bash
   flyctl auth login
   ```
2. Aprovisionar la infraestructura compartida (MySQL 8, Redis 7 y Elasticsearch 8) y obtener sus URLs/credenciales.
3. Configurar los secretos de entorno en cada app de Fly.io (por ejemplo `JWT_SECRET`, `SERVICE_AUTH_TOKEN`, `MYSQL_HOST`, `REDIS_HOST`, `ELASTICSEARCH_URL`, etc.) usando `flyctl secrets set`:
   ```bash
   flyctl secrets set -a uajs-smartcampus-api-gateway JWT_SECRET=... SERVICE_AUTH_TOKEN=...
   ```
   En `api-gateway`, las URLs internas hacia los microservicios en la red privada de Fly.io usan el formato:
   `http://uajs-smartcampus-<servicio>.internal:<puerto>` (por ejemplo `http://uajs-smartcampus-auth-service.internal:3001`).

## Despliegue

- **Solo API Gateway (desde la raíz):**
  ```bash
  flyctl deploy
  ```
- **Un servicio específico (desde la raíz):**
  ```bash
  flyctl deploy -c infrastructure/fly/fly.auth-service.toml .
  ```
- **Todos los 12 servicios (PowerShell, desde la raíz):**
  ```powershell
  .\scripts\deploy\fly-deploy-all.ps1
  ```
