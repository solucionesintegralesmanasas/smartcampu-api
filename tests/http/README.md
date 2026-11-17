# Colección de REST Client — evidencias de integración

Colección de peticiones preparadas para **repetir las pruebas de integración** del
proyecto Smart Campus UAJS sin depender de Postman. Se abre con la extensión
[REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
de VS Code: cada bloque `###` aparece como una petición ejecutable con su enlace
**Send Request** encima.

## Archivos

| Archivo | Qué demuestra | Destino de las peticiones |
| --- | --- | --- |
| `01-gateway.http` | Recorrido completo por el **API Gateway** (`:3000`): autenticación, los 11 servicios y los negativos del gateway | Siempre `http://localhost:3000` |
| `02-inter-servicio.http` | **Comunicación entre microservicios**: puertos internos, `X-Service-Token`, identidad propagada y rechazos | Directo a `:3001` … `:3011` |

Los archivos por servicio que ya existían (`apps/<servicio>/tests/*.http`) siguen
siendo la referencia detallada de cada CRUD; esta carpeta es la vista de
**integración**: un solo login, un solo juego de IDs y las llamadas que realmente
cruzan de un servicio a otro.

## Requisitos

1. `npm run docker:up` (MySQL 3307, Redis 6379, Elasticsearch 9200).
2. Migraciones y seeds aplicados (`scripts/migrations`, `scripts/seed`).
3. Los 12 servicios levantados (`npm run dev`).
4. Usuario `evidencia.qa@uajs.edu` / `EvidenciaQA.2026` con rol **SUPERADMIN**.

## Orden de ejecución

`01-gateway.http`

1. **S01.01 Login** — imprescindible: el resto encadena
   `{{login.response.body.data.accessToken}}`. Si se ejecuta antes cualquier otra
   petición, el gateway responde `401`.
2. S00 → S11 en orden (los `GET` por id usan IDs ya sembrados, no dependen de
   ningún `POST`).
3. S06.06 crea una reserva y S06.07 intenta solaparla → `409`, en ese orden.
4. S12 son los negativos del gateway (`401`, `404`, `400`).

`02-inter-servicio.http`

1. C00 no necesita token (health de cada servicio).
2. C01 reproduce `resource.client.js` de booking-service, incluidos los `401` sin
   token y con token inválido.
3. C02/C03 reproducen los clientes de storage de request-service y pqrs-service,
   incluido el `403` de "archivo de otro usuario".
4. C04.08 crea una solicitud **sin pasar por el gateway**; C04.09 y C04.10
   demuestran que sin `X-Service-Token` la identidad se ignora (`401`).

## Qué se está demostrando con cada bloque

- **Gateway** — valida el JWT (`auth.middleware`), aplica rate limit, inyecta
  `X-User-*` y reescribe el prefijo público en español al prefijo interno en
  inglés (`pathRewrite` en `proxy.middleware.js`). Por eso `/api/v1/reservas/...`
  llega a `/api/v1/bookings/...` y `/api/v1/solicitudes/solicitudes` conserva el
  doble prefijo.
- **Inter-servicio** — la confianza no viene del JWT sino del secreto compartido
  `SERVICE_AUTH_TOKEN`: solo si `X-Service-Token` es correcto el servicio acepta
  `X-User-*` como identidad. Esto es lo que permite que booking-service consulte
  a resource-service y que request-service valide un adjunto en storage-service
  *en nombre del usuario*, sin que el usuario tenga que estar autenticado contra
  esos servicios.

## Verificación en base de datos

```sql
-- Conexión: 127.0.0.1:3307 · uajs_user / uajs206**
SELECT id, reference_number, status_id, booking_date, start_time, end_time
  FROM uajs_bookings.bookings ORDER BY id DESC LIMIT 5;

SELECT id, ticket_number, status_id, title
  FROM uajs_requests.requests ORDER BY id DESC LIMIT 5;

SELECT id, owner_type, original_name, size_bytes
  FROM uajs_storage.files ORDER BY id DESC LIMIT 5;
```

## Notas

- Las peticiones `POST` crean datos reales (reserva, solicitud, recurso, archivo).
  Para repetir la prueba basta con cambiar `code`, `title` o las fechas.
- `S03.04` (`/api/v1/catalogos/campuses`) devuelve **500** a propósito: es un
  defecto conocido del `campus` de catalog-service (tabla `uajs_catalog.sedes`
  inexistente). La fuente válida de sedes es `S04.01`
  (`/api/v1/universidad/sedes`), de donde sale `campusUuid`.
- `@campusUuid = e5c4aa33-cbe5-11f1-9d9d-4e6483f921e9` es el UUID real de
  "Sede Principal" en `uajs_academic.campuses`; el recurso lo exige como UUID
  (Zod) y lo guarda junto a `campusName` como snapshot.
- `C05` documenta la parte asíncrona (BullMQ/Redis): no se puede ejercitar con
  REST Client, se verifica con `docker logs` y consultando
  `uajs_notifications.notifications`.
- **Defectos reales que la colección deja en evidencia** (no son errores del
  archivo `.http`):
  - `S01.02` `/api/v1/auth/refresh` no está en `PUBLIC_ROUTES` del gateway: hay
    que enviar `Authorization` incluso cuando el accessToken ya caducó, que es
    justo el caso de uso de un refresh.
  - Si `S01.02` se ejecuta en el mismo segundo que `S01.01`, auth-service firma
    un refreshToken idéntico (`{sub, iat, exp}` iguales) y el `UNIQUE` de
    `token_hash` responde `500 Duplicate entry`.
  - `S03.04` devuelve `500` por la tabla `uajs_catalog.sedes` inexistente.
