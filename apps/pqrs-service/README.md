# pqrs-service

Microservicio de **PQRS** (peticiones, quejas, reclamos, sugerencias y felicitaciones) de UAJS Smart Campus.

- **Puerto:** 3010
- **Prefijo:** `/api/v1/pqrs` (el API Gateway lo reenvía tal cual)
- **Base de datos:** `uajs_pqrs` (`scripts/migrations/ms-pqrs_001_init.sql`)
- **Índice Elasticsearch:** `uajs_pqrs`

## Características

- Radicación de PQRS identificadas o **anónimas** (con correo de contacto).
- Cálculo del **plazo de respuesta en días hábiles** (lunes a viernes, excluyendo `HOLIDAYS`).
- Máquina de estados: `radicada → en_tramite → respondida → cerrada` (con reapertura `respondida → en_tramite`).
- Asignación a funcionarios, respuestas formales y auditoría inmutable de transiciones.
- Calificación de satisfacción (1 a 5) por parte del peticionario.
- Publicación del evento `PqrsRespondidaEvent` en BullMQ al emitir una respuesta definitiva.

## Endpoints

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/api/v1/pqrs/tipos` | Público |
| GET | `/api/v1/pqrs/estados` | Público |
| POST | `/api/v1/pqrs` | Público o autenticado |
| GET | `/api/v1/pqrs/consulta/:ticket?email=` | Público |
| GET | `/api/v1/pqrs/mias` | Autenticado |
| GET | `/api/v1/pqrs` | ADMIN / STAFF |
| GET | `/api/v1/pqrs/:uuid` | Dueño o personal |
| PATCH | `/api/v1/pqrs/:uuid/asignacion` | ADMIN / STAFF |
| POST | `/api/v1/pqrs/:uuid/respuestas` | ADMIN / STAFF |
| PATCH | `/api/v1/pqrs/:uuid/estado` | ADMIN / STAFF |
| POST | `/api/v1/pqrs/:uuid/calificacion` | Dueño |

Documentación interactiva: `/api-docs`. Salud: `/healthz`.

## Eventos publicados

- `PqrsRespondidaEvent` → cola `uajs.pqrs.respondidas.v1`.

## Variables de entorno

Ver `.env.example`. Destacan `JWT_SECRET` (verificación D4), `HOLIDAYS` y `PQRS_INDEX`.

## Pruebas

```bash
npm run test:unit
npm run test:coverage
```
