# event-service

Microservicio de **eventos institucionales** y sus inscripciones (UAJS Smart Campus).

- **Puerto:** 3008
- **Prefijo:** `/api/v1/eventos` (el API Gateway lo reenvía tal cual)
- **Base de datos:** `uajs_events` (`scripts/migrations/ms-events_001_init.sql`)
- **Índice Elasticsearch:** `uajs_events`

## Máquina de estados

`draft → published → ongoing → completed` y `published → cancelled`.
Solo los eventos en borrador se eliminan; solo se editan en borrador o publicados sin inscritos.

## Endpoints

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/api/v1/eventos/categorias` | Público |
| GET | `/api/v1/eventos/estados` | Público |
| GET | `/api/v1/eventos` | Público (gestión ve borradores) |
| POST | `/api/v1/eventos` | ADMIN / STAFF |
| GET | `/api/v1/eventos/:uuid` | Público (gestión ve borradores) |
| PUT | `/api/v1/eventos/:uuid` | ADMIN / STAFF |
| DELETE | `/api/v1/eventos/:uuid` | ADMIN / STAFF |
| PATCH | `/api/v1/eventos/:uuid/estado` | ADMIN / STAFF |
| POST | `/api/v1/eventos/:uuid/inscripciones` | Autenticado |
| GET | `/api/v1/eventos/:uuid/inscripciones` | ADMIN / STAFF |
| DELETE | `/api/v1/eventos/:uuid/inscripciones` | Autenticado |

Documentación interactiva: `/api-docs`. Salud: `/healthz`.

## Eventos publicados

- `EventoProgramadoEvent` → cola `uajs.eventos.programados.v1` (al publicar un evento).

## Pruebas

```bash
npm run test:unit
```
