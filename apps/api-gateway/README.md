# 🚪 API Gateway - UAJS Smart Campus

Punto de entrada único para todas las solicitudes externas al ecosistema de microservicios. Centraliza autenticación, rate limiting (Token Bucket), trazabilidad distribuida y enrutamiento por proxy hacia los microservicios internos.

## 📋 Propósito

- **Autenticación**: verifica JWT firmados con `JWT_SECRET` (compartido con `auth-service`) y expone rutas públicas para login/registro/reset de contraseña.
- **Rate Limiting**: aplica Token Bucket por IP o usuario, con headers `X-RateLimit-*` y `Retry-After`.
- **Trazabilidad**: genera/propaga `X-Request-Id` en toda la cadena.
- **Proxy**: enruta `/api/v1/*` hacia los 11 microservicios internos (puertos 3001–3011).

## 📋 Contrato JWT

El gateway valida tokens JWT firmados con `JWT_SECRET`. El payload **debe** contener:

| Claim   | Tipo       | Descripción                                      |
| ------- | ---------- | ------------------------------------------------ |
| `sub`   | `number`   | ID numérico del usuario.                         |
| `roles` | `string[]` | Roles asignados (ej. `["ESTUDIANTE", "ADMIN"]`). |
| `exp`   | `number`   | Timestamp de expiración.                         |
| `iat`   | `number`   | Timestamp de emisión.                            |

## ⚙️ Variables de Entorno

| Variable                     | Descripción                                   | Default/Requerido |
| ---------------------------- | --------------------------------------------- | ----------------- |
| `PORT`                       | Puerto de escucha del gateway                 | `3000`            |
| `NODE_ENV`                   | Entorno (`development`, `production`, `test`) | `development`     |
| `JWT_SECRET`                 | Clave para verificar JWT (mín. 32 caracteres) | _Requerido_       |
| `CORS_ALLOWED_ORIGINS`       | Orígenes permitidos (separados por coma)      | _Requerido_       |
| `RATE_LIMIT_BUCKET_CAPACITY` | Capacidad máxima del Token Bucket             | `100`             |
| `RATE_LIMIT_REFILL_PER_SEC`  | Tokens añadidos por segundo                   | `10`              |
| `SERVICE_AUTH_URL`           | `auth-service` interno                        | _Requerido_       |
| `SERVICE_USER_URL`           | `user-service` interno                        | _Requerido_       |
| `SERVICE_CATALOG_URL`        | `catalog-service` interno                     | _Requerido_       |
| `SERVICE_UNIVERSITY_URL`     | `university-service` interno                  | _Requerido_       |
| `SERVICE_RESOURCE_URL`       | `resource-service` interno                    | _Requerido_       |
| `SERVICE_BOOKING_URL`        | `booking-service` interno                     | _Requerido_       |
| `SERVICE_REQUEST_URL`        | `request-service` interno                     | _Requerido_       |
| `SERVICE_EVENT_URL`          | `event-service` interno                       | _Requerido_       |
| `SERVICE_NOTIFICATION_URL`   | `notification-service` interno                | _Requerido_       |
| `SERVICE_PQRS_URL`           | `pqrs-service` interno                        | _Requerido_       |
| `SERVICE_STORAGE_URL`        | `storage-service` interno                     | _Requerido_       |

Consulta `.env.example` para una plantilla completa.

## 🚀 Cómo arrancar localmente

1. Instala dependencias del monorepo (desde la raíz):
   ```bash
   npm install
   ```
2. Crea tu `.env` a partir del ejemplo:
   ```bash
   cp .env.example .env
   ```
   Completa `JWT_SECRET` (mín. 32 caracteres) y ajusta las URLs internas.
3. Desde la raíz del monorepo, ejecuta el gateway:
   ```bash
   npm run dev -w @uajs/api-gateway
   ```
   O directamente dentro del paquete:
   ```bash
   cd apps/api-gateway
   npm run dev
   ```
4. Verifica el healthcheck:
   ```bash
   curl http://localhost:3000/health
   ```

## 🧪 Cómo correr tests

```bash
cd apps/api-gateway
npm test        # Jest (unit + e2e)
npm run lint    # ESLint sobre src/ y tests/
```

> Los tests de E2E levantan un servidor mock local para el `user-service` y
> verifican el proxy con headers inyectados, sin depender de microservicios reales.
