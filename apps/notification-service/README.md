# notification-service

Microservicio de **notificaciones multicanal** de UAJS Smart Campus, alimentado por eventos de dominio.

- **Puerto:** 3009
- **Prefijo:** `/api/v1/notificaciones` (el API Gateway lo reenvía tal cual)
- **Base de datos:** `uajs_notifications` (`scripts/migrations/ms-notifications_001_init.sql`)
- **Cola de entregas:** `uajs.notificaciones.entregas.v1`

## Cómo funciona

1. **Consumidores de eventos** (BullMQ): escuchan `SolicitudCreadaEvent`, `SolicitudEstadoCambiadoEvent`,
   `ReservaConfirmadaEvent`, `EventoProgramadoEvent` y `PqrsRespondidaEvent`.
2. **Dispatcher**: resuelve la plantilla (BD o por defecto), renderiza las variables y crea:
   - una notificación **in-app** (entregada de inmediato),
   - una entrega **por correo** y una **push** si las preferencias del usuario lo permiten.
3. **Cola de entregas**: un worker ejecuta el envío por canal con reintentos (5 intentos, backoff exponencial).
4. **Idempotencia**: cada `eventId` se reclama en Redis (`SET NX`) para no procesar dos veces el mismo evento.
5. Al generar una notificación se publica `NotificacionGeneradaEvent`.

## Canales

El envío real se delega en un adaptador de canal (`src/core/channels`). Por defecto se usa el driver
`log`, que simula el envío. Para conectar un proveedor real (SMTP/SES, Web Push/FCM), crea una clase que
extienda `ChannelAdapter`, implementa `send` y regístrala en `src/core/channels/index.js` con su driver.

## Endpoints

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/api/v1/notificaciones` | Autenticado |
| PATCH | `/api/v1/notificaciones/leer-todas` | Autenticado |
| PATCH | `/api/v1/notificaciones/:uuid/leida` | Dueño |
| POST | `/api/v1/notificaciones/difusion` | ADMIN / STAFF |
| GET / PUT | `/api/v1/notificaciones/preferencias` | Dueño |
| POST | `/api/v1/notificaciones/suscripciones-push` | Dueño |
| DELETE | `/api/v1/notificaciones/suscripciones-push/:uuid` | Dueño |
| GET | `/api/v1/notificaciones/plantillas` | ADMIN / STAFF |
| PUT | `/api/v1/notificaciones/plantillas/:code` | ADMIN |

Documentación interactiva: `/api-docs`. Salud: `/healthz`.

## Pruebas

```bash
npm run test:unit
npm run test:coverage
```
