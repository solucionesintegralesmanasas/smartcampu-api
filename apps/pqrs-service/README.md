# pqrs-service

Peticiones, Quejas, Reclamos y Sugerencias (PQRS) de la comunidad
universitaria, con radicación anónima opcional, plazo de respuesta por tipo
y respuestas oficiales del personal encargado.

## Flujo de estados

```
pending → in_review → responded → closed
```

Solo el personal administrativo (`SUPERADMIN`, `ADMIN`, `STAFF`) puede mover
el flujo (`en-revision`, `responder`, `cerrar`); quien radica la PQRS solo
puede crearla y consultarla.

## Radicación anónima

`POST /pqrs` acepta `isAnonymous: true`. En ese caso:

- `requester_uuid`/`requester_name` quedan en `NULL` en la tabla `pqrs` — la
  identidad del solicitante no se almacena en absoluto, ni siquiera para uso
  interno.
- No se registra entrada de auditoría por la creación (no hay "actor" que
  registrar sin romper la anonimidad).
- El adjunto que se enganche a esa PQRS tampoco guarda `uploader_uuid`.

Como una PQRS anónima no tiene `requester_uuid`, quien la radicó no puede
volver a consultarla por `GET /pqrs/:id` (fallaría con 403, igual que
cualquier otro usuario sin relación con el caso). Para eso existe
`GET /pqrs/rastrear/:ticketNumber`: el número de radicado entregado al
crear la PQRS actúa como credencial de consulta, sin chequeo de propiedad.

## Respuesta oficial

`POST /pqrs/:id/responder` (admin/staff) crea la respuesta oficial en
`pqrs_responses` **y** transiciona la PQRS a `responded` en la misma
operación (ver `PqrsService#respond`), reflejando el flujo real: no hay
"responder" sin que quede una respuesta registrada.

## Variables de entorno

Ver `.env.example`. `SERVICE_AUTH_TOKEN` debe coincidir con el del
api-gateway y el resto de servicios. `SERVICE_STORAGE_URL` se usa para
validar adjuntos contra storage-service (mismo patrón que
`request-service`).
