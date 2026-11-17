# resource-service

Recursos físicos reservables del campus (aulas, laboratorios, equipos,
vehículos) y su disponibilidad **operativa** (horario semanal + bloqueos
excepcionales). Base propia `uajs_resources`.

## Alcance de este servicio vs. booking-service

Este servicio solo sabe si un recurso *podría* usarse a cierta hora según su
estado, horario y bloqueos — `GET /recursos/:id/disponibilidad`. **No sabe
nada de reservas concretas de otros usuarios**: esa comprobación (¿ya hay
alguien más reservado en ese rango?) vive en `booking-service`, que llama a
este endpoint como un chequeo adicional antes de confirmar.

## No implementado en esta fase

`inventory_items` (elementos individuales dentro de un recurso con
inventario, ej. sillas/proyectores de una sala) existe en la migración
(`scripts/migrations/ms-resources_001_init.sql`) pero no tiene módulo REST
todavía — no era necesario para el flujo de reservas.

## Seguridad entre servicios

Igual que el resto: `X-Service-Token` + `X-User-Id`/`X-User-Uuid`/
`X-User-Name`/`X-User-Roles` inyectados por el gateway (ver
`identity.middleware.js`). `GET /recursos/:id/disponibilidad` acepta
cualquier llamada con el token de servicio válido, con o sin identidad de
usuario final adjunta, para que `booking-service` pueda consultarla
directamente.

## Variables de entorno

Ver `.env.example`. `SERVICE_AUTH_TOKEN` debe coincidir con el del
api-gateway y el resto de servicios.
