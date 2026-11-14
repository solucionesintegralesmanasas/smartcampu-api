# resource-service

Microservicio de **recursos reservables** del campus (UAJS Smart Campus).

- **Puerto:** 3005
- **Prefijo:** `/api/v1/recursos` (el API Gateway lo reenvía tal cual)
- **Base de datos:** `uajs_resources` (`scripts/migrations/ms-resources_001_init.sql`)
- **Índice Elasticsearch:** `uajs_resource`

## Módulos

- **categorias / estados**: catálogos de solo lectura.
- **recursos**: CRUD con búsqueda y soft delete.
- **horarios**: horario semanal por recurso (reemplazo transaccional).
- **bloqueos**: bloqueos puntuales por fecha/horario.
- **inventario**: bienes asociados al recurso.
- **disponibilidad**: contrato interno que consume `booking-service`.

## Contrato de disponibilidad

`GET /api/v1/recursos/:id/disponibilidad?fecha=YYYY-MM-DD&horaInicio=HH:mm&horaFin=HH:mm`

Acepta un JWT de usuario o el `SERVICE_AUTH_TOKEN`. Responde:

```json
{ "success": true, "data": { "disponible": true, "motivo": null, "recurso": { "id": 1, "uuid": "...", "nombre": "..." } } }
```

La evaluación (función pura `evaluarDisponibilidad`) considera, en orden: recurso activo y
reservable, horario del día que cubra la franja, y ausencia de bloqueos que se solapen.

## Pruebas

```bash
npm run test:unit
```
