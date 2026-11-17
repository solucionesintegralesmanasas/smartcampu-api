# Evidencia 1 · Colección REST Client

Colección de peticiones para ejecutar los casos de la **matriz de pruebas**
(`docs/evidencias/evidencia-1-plan-matriz-pruebas.md`) desde VS Code con la
extensión [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client).
Cada petición lleva el ID del caso (`CP-…`) en su comentario.

## Archivos

| Archivo | Tipo de prueba | Casos principales |
| --- | --- | --- |
| `00-preparacion.http` | Preparación: salud del entorno y login | CP-INF-06, CP-AUT-04 |
| `01-exitosas.http` | **Pruebas exitosas** (happy path) | CP-AUT-01, CP-AUT-04, CP-RES-01, CP-SOL-01, CP-PQR-01, CP-EVT-01, CP-STO-01 |
| `02-validaciones.http` | **Validaciones**, permisos y reglas de negocio | CP-AUT-02/03/05, CP-GW-01/02/03, CP-AUZ-01, CP-EVT-05, CP-RES-02/03, CP-VAL-R01/R02 |
| `03-persistencia.http` | **Persistencia**: crear → leer → historial, y consultas SQL | P-RES-01…04, P-SOL-01…04, P-USR-01/02, P-DB-01…03 |
| `04-regresion.http` | **Regresión**: flujos existentes y defectos conocidos | CP-INF-06, CP-AUT-04/05, lecturas de catálogo, datos previos |

## Requisitos

1. `npm run docker:up` (MySQL 3307, Redis 6379, Elasticsearch 9200).
2. Migraciones y semillas aplicadas (`docs/guia-inicializacion.md`).
3. Los 12 servicios levantados (`npm run dev`).
4. Usuario `evidencia.qa@uajs.edu` / `EvidenciaQA.2026` con rol **SUPERADMIN**.
5. Precondición de eventos: el evento `1` debe estar **publicado**
   (`POST /api/v1/eventos/eventos/1/publicar` con token de administrador).
   Sin ella, CP-EVT-01 responde 409 y CP-EVT-02 no prueba nada.

## Orden de ejecución

1. `00-preparacion.http` (verifica el entorno).
2. `01-exitosas.http`, después `02-validaciones.http`.
3. `03-persistencia.http`, de arriba abajo.
4. `04-regresion.http` (repetir después de cada corrección).

Las variables de cada archivo son independientes; cada archivo inicia sesión
por sí mismo. Las peticiones con nombre (`# @name login`, `# @name persReserva`, …)
encadenan la respuesta con `{{nombre.response.body.data.…}}`.

## Repetir la ejecución

Las peticiones que crean datos **dejan registros en la base**. Para repetirlas:

- **Fechas de reserva:** cambiar `@bookingDate` (01), `@slotDate` (02) y
  `@fechaPersistencia` (03). Una franja ya ocupada devuelve 409.
- **Usuario de estudiante:** CP-AUT-01 responde 409 en las siguientes ejecuciones
  (correcto: el email ya existe).
- **Documento:** CP-AUT-01 usa el documento `1098000111`. Si se cambia, cambiar
  también el de CP-AUT-02b.

## Defectos que la colección deja en evidencia

| Caso | Comportamiento | Esperado |
| --- | --- | --- |
| CP-AUT-02b | Registrar un documento ya existente responde **500** (`Duplicate entry ... uq_persons_document`). | 409 |
| CP-CAT-01 | `/api/v1/catalogos/campuses` responde **500** (tabla `uajs_catalog.sedes` inexistente). | Conocido |
| CP-AUT-04 (refresh) | `/api/v1/auth/refresh` en el mismo segundo que el login produce un refreshToken idéntico y un 500 (`token_hash` único). Por eso CP-AUT-04 espera 2 s antes del refresh. | 200 |

## Notas

- Las consultas SQL de `03-persistencia.http` (bloque `P-DB`) están comentadas:
  ejecutarlas en DBeaver/HeidiSQL, no con REST Client.
- Las notificaciones son asíncronas (BullMQ): no se verifican en la respuesta HTTP
  (CP-NOT-01 se comprueba en `uajs_notifications.notifications`).
- La carga de archivo (CP-STO-01) usa `multipart/form-data` en línea.
