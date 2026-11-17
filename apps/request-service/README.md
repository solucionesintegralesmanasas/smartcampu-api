# request-service

Mesa de servicio: certificados, constancias, cambios de matrícula,
apelaciones académicas y peticiones generales.

## Flujo de estados

```
pending → in_review → approved → closed
              ↓
           rejected → closed
```

A diferencia de `booking-service`, este flujo **no tiene estado de
cancelación** — coincide con el catálogo real de `request_statuses`
(`pending|in_review|approved|rejected|closed`). El solicitante no puede
retirar su propia solicitud; solo puede comentar y adjuntar archivos.

## Integración con storage-service

`POST /solicitudes/:requestId/adjuntos` no sube un archivo directamente:
engancha un archivo que **ya existe** en `storage-service` (subido antes vía
`POST /api/v1/storage/archivos`), verificando que le pertenece al usuario
que lo adjunta. La llamada a `storage.client.js` reenvía la identidad del
propio usuario (no solo el `X-Service-Token`), porque el endpoint de
storage-service que consulta exige ser el dueño del archivo o admin/staff —
así nadie puede enganchar a su solicitud un archivo ajeno.

## Comentarios internos

`request_comments.is_internal` permite notas de solo personal, no visibles
para el solicitante. Solo `SUPERADMIN/ADMIN/STAFF` pueden crear un comentario
marcado como interno.

## Autorización

Cualquier usuario autenticado puede crear solicitudes y ver/comentar las
propias (dueño o asignado). Iniciar revisión, aprobar, rechazar y cerrar son
acciones de `SUPERADMIN/ADMIN/STAFF`.

## Variables de entorno

Ver `.env.example`. `SERVICE_AUTH_TOKEN` debe coincidir con el del
api-gateway y el resto de servicios. `SERVICE_STORAGE_URL` debe apuntar a
storage-service.
