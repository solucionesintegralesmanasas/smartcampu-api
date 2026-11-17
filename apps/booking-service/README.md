# booking-service

Ciclo de vida de reservas de recursos físicos: creación, aprobación,
confirmación, cancelación y auditoría inmutable de cada transición.

## Flujo de estados

```
pending → approved → confirmed → completed
   ↓          ↓           ↓
rejected   cancelled   cancelled
```

`pending` solo existe si el tipo de reserva (`booking_types.requires_approval`)
lo exige; si no, la reserva nace directamente en `approved`. Cada transición
queda registrada de forma inmutable en `booking_audit_trail`
(`GET /reservas/:id/historial`).

## Antes de crear una reserva, se valida contra otros dos servicios

1. **resource-service** (`SERVICE_RESOURCE_URL`): existencia del recurso y
   disponibilidad **operativa** (`GET /recursos/:id/disponibilidad` — estado
   reservable + horario semanal + sin bloqueos excepcionales). Si
   resource-service no responde, se trata como **no disponible** — es más
   seguro rechazar una reserva que confirmarla sin poder verificar el
   horario real del recurso (ver `src/clients/resource.client.js`).
2. **Contra sus propias reservas** (`bookings.findOverlapping`): ¿ya existe
   otra reserva activa (no cancelada/rechazada) del mismo recurso que se
   traslape con el rango solicitado?

Ambas validaciones deben pasar para que se cree la reserva.

## Autorización

Cualquier usuario autenticado puede crear reservas y ver/cancelar las
propias. Aprobar, rechazar, confirmar y completar son acciones de
`SUPERADMIN/ADMIN/STAFF`. Listar (`GET /reservas`) para un usuario normal
siempre se filtra a sus propias reservas.

## Variables de entorno

Ver `.env.example`. `SERVICE_AUTH_TOKEN` debe coincidir con el del
api-gateway y el resto de servicios. `SERVICE_RESOURCE_URL` debe apuntar a
resource-service.
