# event-service

Eventos universitarios (académicos, culturales, deportivos, talleres) con
inscripción, control de capacidad y check-in de asistencia.

## Flujo de estados del evento

```
draft → published → ongoing → completed
   ↓        ↓           ↓
       cancelled (desde cualquiera de los tres primeros)
```

Cualquier usuario autenticado puede crear un evento (queda como su
organizador). Solo el organizador o `SUPERADMIN/ADMIN/STAFF` pueden
editarlo, transicionarlo o borrarlo.

## Inscripciones con lista de espera automática

`POST /eventos/:id/inscripciones` solo funciona mientras el evento está
`published` y antes de `registration_deadline`. Si `max_capacity` está lleno,
la inscripción queda `waitlisted` en vez de `confirmed`. Al cancelar una
inscripción `confirmed`, se promueve automáticamente a la persona más
antigua en lista de espera (`InscripcionService#cancel`).

Una inscripción cancelada se puede reactivar (en vez de fallar por la
`UNIQUE KEY (event_id, registrant_uuid)`): volver a llamar a
`POST /eventos/:id/inscripciones` sobre una inscripción `cancelled` la
actualiza en vez de intentar insertar una fila duplicada.

## Check-in

`POST /eventos/:eventId/inscripciones/:id/check-in` (admin/staff) marca una
inscripción `confirmed` como `attended`. El `qr_code` generado al confirmar
una inscripción está pensado para ese flujo de escaneo en la entrada.

## Variables de entorno

Ver `.env.example`. `SERVICE_AUTH_TOKEN` debe coincidir con el del
api-gateway y el resto de servicios.
