# notification-service

Notificaciones in-app generadas a partir de eventos de dominio de los demás
microservicios, más plantillas, preferencias de canal por usuario y
suscripciones push (registro únicamente — no hay envío real de web-push).

## Cómo llegan los eventos de otros servicios

`booking-service`, `request-service`, `event-service` y `pqrs-service`
publican sus eventos de dominio notificables (reserva aprobada, PQRS
respondida, etc.) en la **misma cola BullMQ** que este servicio escucha
(`NOTIFICATION_QUEUE`, por defecto `notification_events`), con
`job.name = 'domain_event'`.

**Esto es intencional y no un descuido:** BullMQ reparte los jobs de una
cola entre todos los workers que la escuchan (consumidores en competencia,
no pub/sub). Si `notification-service` escuchara la cola de auditoría propia
de cada servicio (`booking_events`, `request_events`, ...), competiría con
el consumidor de auditoría de ese mismo servicio y cada evento llegaría a
uno u otro al azar — nunca a ambos. Por eso cada uno de esos 4 servicios
tiene su propio `src/jobs/producers/notification.producer.js` que publica en
esta cola dedicada, independiente de su cola de auditoría interna
(`*_events`, consumida solo por su propio `*.consumer.js`).

Ver el mapa completo de eventos soportados en
`src/jobs/consumers/domain-events.consumer.js` (`EVENT_DEFINITIONS`).
Un evento con un `eventType` no reconocido, o sin `recipientUuid` (ej. una
PQRS radicada de forma anónima), se descarta sin error.

## Notificaciones in_app vs otros canales

Como no existe todavía un worker de envío real de correo/push (fuera del
envío de recuperación de contraseña ya implementado en `auth-service`), toda
notificación creada con canal `in_app` se marca `delivered` de inmediato: el
registro en la tabla ya es, en sí mismo, la entrega. Notificaciones con otro
`channel` quedan en `queued` a la espera de un worker de envío real
(no implementado — ver `NotificacionService#create`).

## Variables de entorno

Ver `.env.example`. `SERVICE_AUTH_TOKEN` debe coincidir con el del
api-gateway y el resto de servicios.
