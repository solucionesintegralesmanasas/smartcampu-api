# Evidencia 1 — Resultados de ejecución de la colección REST Client

**Proyecto:** UAJS Smart Campus — API
**Colección:** `tests/http/evidencia-1/` (00 a 04)
**Fecha de ejecución:** 2026-10-24
**Entorno:** gateway `http://localhost:3000`, servicios en host, MySQL 3307, Redis 6379, Elasticsearch 9200
**Ejecutor:** [Nombre]

## 1. Resumen

| Concepto | Valor |
| --- | --- |
| Peticiones ejecutadas | 62 |
| Aprobadas (estado esperado = obtenido) | 60 |
| Fallidas | 2 |
| Aprobadas pero **no válidas** (ver §4) | 1 |
| **Aprobadas válidas** | **59** |

| Archivo | Peticiones | Aprobadas | Fallidas |
| --- | --- | --- | --- |
| `00-preparacion.http` | 4 | 4 | 0 |
| `01-exitosas.http` | 9 | 8 | 1 (CP-EVT-01, precondición) |
| `02-validaciones.http` | 20 | 19 * | 1 (CP-AUT-02b, defecto) |
| `03-persistencia.http` | 10 | 10 | 0 |
| `04-regresion.http` | 19 | 19 | 0 |

\* CP-EVT-02 cuenta como aprobada, pero no es válida (ver §4).

## 2. Método de ejecución

Las peticiones se ejecutaron **con el mismo contenido, orden y encadenamiento**
que los archivos `.http`, mediante un script que llama al gateway. No se
usó la interfaz de VS Code, por lo que **no hay capturas de pantalla** de
REST Client: el registro textual de cada respuesta está en la §3.

Para generar las capturas desde VS Code: abrir cada archivo `.http`, pulsar
**Send Request** en cada bloque y capturar la pestaña de respuesta (estado,
cabeceras y cuerpo). Las capturas recomendadas son las de §5.

## 3. Registro de peticiones

| Caso | Archivo | Petición | Esperado | Obtenido | Resultado | Observación |
| --- | --- | --- | --- | --- | --- | --- |
| CP-INF-06 | 00 | Liveness | 200 | 200 | OK | |
| CP-INF-06 | 00 | Readiness | 200 | 200 | OK | |
| CP-AUT-04 | 00 | Login admin | 200 | 200 | OK | |
| — | 00 | Perfil admin | 200 | 200 | OK | |
| CP-AUT-01 | 01 | Registrar estudiante | 201/409 | 201 | OK | Primera ejecución |
| CP-AUT-04 | 01 | Login estudiante | 200 | 200 | OK | |
| CP-GW-04 | 01 | Sedes por gateway | 200 | 200 | OK | |
| CP-AUZ-02 | 01 | Usuarios (admin) | 200 | 200 | OK | |
| CP-RES-01 | 01 | Crear reserva | 201 | 201 | OK | `pending` |
| CP-SOL-01 | 01 | Crear solicitud | 201 | 201 | OK | |
| CP-PQR-01 | 01 | Radicar PQRS anónima | 201 | 201 | OK | |
| CP-EVT-01 | 01 | Inscribirse en evento | 201 | **409** | **FALLA** | Precondición: evento 1 no publicado (§4.1) |
| CP-STO-01 | 01 | Subir PDF | 201 | 201 | OK | |
| CP-AUT-02 | 02 | Email duplicado | 409 | 409 | OK | |
| CP-AUT-02b | 02 | Documento duplicado (otro email) | 409 | **500** | **FALLA** | **Defecto** (§4.2) |
| CP-AUT-03 | 02 | Registro incompleto | 400 | 400 | OK | |
| CP-AUT-03 | 02 | Email inválido | 400 | 400 | OK | |
| CP-AUT-05 | 02 | Clave incorrecta | 401 | 401 | OK | |
| CP-AUT-05 | 02 | Usuario inexistente | 401 | 401 | OK | |
| CP-GW-01 | 02 | Sin token | 401 | 401 | OK | |
| CP-GW-02 | 02 | Firma inválida | 401 | 401 | OK | |
| CP-GW-02 | 02 | Esquema Basic | 401 | 401 | OK | |
| CP-GW-03 | 02 | Ruta inexistente | 404 | 404 | OK | |
| CP-AUZ-01 | 02 | Estudiante en listado admin | 403 | 403 | OK | |
| CP-EVT-05 | 02 | Estudiante check-in | 403 | 403 | OK | |
| CP-EVT-05 | 02 | Estudiante lista inscripciones | 403 | 403 | OK | |
| CP-RES-02a | 02 | Reserva base (conflicto) | 201 | 201 | OK | |
| CP-RES-02b | 02 | Reserva superpuesta | 409 | 409 | OK | `Resource already has a booking` |
| CP-VAL-R01 | 02 | Horario invertido | 400 | 400 | OK | |
| CP-VAL-R02 | 02 | Sin resourceId | 400 | 400 | OK | |
| CP-RES-03 | 02 | Recurso inexistente | 404 | 404 | OK | |
| CP-EVT-02 | 02 | Inscripción duplicada | 409 | 409 | OK (no válida) | El 409 es por evento no publicado (§4.1) |
| CP-PQR-02 | 02 | PQRS inexistente | 404 | 404 | OK | |
| P-RES-01 | 03 | Crear reserva | 201 | 201 | OK | |
| P-RES-02 | 03 | Leer reserva por id | 200 | 200 | OK | Mismos datos que al crear |
| P-RES-03 | 03 | Historial de reserva | 200 | 200 | OK | |
| P-RES-04 | 03 | Listado incluye reserva | 200 | 200 | OK | |
| P-SOL-01 | 03 | Crear solicitud | 201 | 201 | OK | |
| P-SOL-02 | 03 | Transición en-revision | 200 | 200 | OK | |
| P-SOL-03 | 03 | Releer solicitud | 200 | 200 | OK | Estado actualizado |
| P-SOL-04 | 03 | Historial de solicitud | 200 | 200 | OK | |
| P-USR-01 | 03 | Login tras registro | 200 | 200 | OK | Usuario persistido |
| P-USR-02 | 03 | Perfil del estudiante | 200 | 200 | OK | |
| CP-INF-06 | 04 | Liveness (regresión) | 200 | 200 | OK | |
| CP-INF-06 | 04 | Readiness (regresión) | 200 | 200 | OK | |
| CP-AUT-04 | 04 | Login (regresión) | 200 | 200 | OK | |
| CP-AUT-05 | 04 | Clave incorrecta (regresión) | 401 | 401 | OK | |
| CP-AUT-04 | 04 | Refresh tras 2 s | 200 | 200 | OK | |
| REG | 04 | Sedes, usuarios, usuario 6, recursos, tipos de reserva, tipos de solicitud, eventos, notificaciones | 200 | 200 (×8) | OK | |
| CP-RES-01 | 04 | Reserva de ejecución previa (id 4) | 200 | 200 | OK | Datos persistidos entre ejecuciones |
| REG | 04 | Solicitud existente (id 1) | 200 | 200 | OK | |
| CP-GW-01 | 04 | Sin token (regresión) | 401 | 401 | OK | |
| CP-GW-03 | 04 | Ruta inexistente (regresión) | 404 | 404 | OK | |
| CP-VAL-R01 | 04 | Horario invertido (regresión) | 400 | 400 | OK | |
| CP-CAT-01 | 04 | Catálogo de sedes (defecto conocido) | 500 | 500 | OK (conocido) | Mensaje: `Breaker is open` (§4.3) |

## 4. Hallazgos

### 4.1 CP-EVT-01 y CP-EVT-02: precondición no cumplida (no es defecto)

La API responde `409 "Registration is only open while the event is published"`
porque el evento `1` no está publicado. Esto cumple la regla de negocio, pero
impide probar la inscripción.

- **Acción:** publicar el evento 1 (`POST /api/v1/eventos/eventos/1/publicar`) y repetir CP-EVT-01.
- **CP-EVT-02 no es válido:** su 409 proviene de la misma regla de publicación, no de la
  duplicidad. Se marca como aprobado **sin validez** hasta repetir la prueba con el evento publicado.

Esta publicación no se ejecutó durante esta corrida porque cambia el estado de un
dato compartido; queda a decisión del responsable.

### 4.2 CP-AUT-02b: defecto de validación (severidad Alta)

Registrar un usuario con un documento ya existente (email distinto) responde **500**
con `Duplicate entry 'CC-1098000111' for key 'persons.uq_persons_document'`.
Debe responder **409** (`ConflictError`), igual que el email duplicado (CP-AUT-02).

- **Impacto:** un error de negocio se presenta como fallo interno, y el cliente no
  puede distinguir un documento repetido de una caída del servicio.
- **Causa probable:** la unicidad se valida solo en la base de datos; el servicio no
  verifica `persons` antes de insertar.
- **Estado:** Fallido. Registrar defecto en la sección 12 del plan.

### 4.3 CP-CAT-01: defecto conocido, con mensaje distinto

El estado coincide (500), pero el mensaje ya no es el documentado
(`Table 'uajs_catalog.sedes' doesn't exist`). Ahora responde `Breaker is open`:
el circuit breaker del servicio está abierto tras los fallos repetidos. Hay que
confirmar la causa antes de cerrar el defecto conocido.

### 4.4 Observaciones de datos

- Las reservas de esta corrida quedaron en resource `1` el 2027-01-27 14:00,
  2027-01-29 10:00 y 2027-02-17 09:00. Repetir la prueba exige cambiar las fechas
  (ver README de la colección).
- Durante el desarrollo de la colección se crearon registros de prueba en
  ejecuciones previas; los conflictos que devolvió la API (409) fueron correctos.

## 5. Capturas recomendadas (pendientes de tomar en VS Code)

| # | Archivo | Qué capturar |
| --- | --- | --- |
| 1 | `01-exitosas.http` | Login (CP-AUT-04) con `accessToken` en la respuesta |
| 2 | `01-exitosas.http` | Reserva creada (CP-RES-01) con `status 201` |
| 3 | `02-validaciones.http` | Reserva superpuesta (CP-RES-02b) con `409` |
| 4 | `02-validaciones.http` | Estudiante en listado admin (CP-AUZ-01) con `403` |
| 5 | `02-validaciones.http` | Documento duplicado (CP-AUT-02b) con `500`, como evidencia del defecto |
| 6 | `03-persistencia.http` | Reserva leída por id (P-RES-02) con los mismos datos |
| 7 | `03-persistencia.http` | Historial de solicitud (P-SOL-04) con dos entradas |
| 8 | DBeaver | Consulta P-DB-01 con la reserva en `pending` |

## 6. Conclusión

La colección ejecuta sin errores de transporte. De **62 peticiones**, **59 son
aprobadas válidas**, **1 falla por defecto real** (CP-AUT-02b), **1 falla por
precondición** (CP-EVT-01) y **1 aprobada no es válida** (CP-EVT-02, pendiente
de repetir con el evento publicado). Los flujos de reservas, solicitudes, PQRS,
almacenamiento, autenticación y autorización por rol funcionan, y los datos
persisten entre peticiones.

La evidencia no está cerrada hasta corregir CP-AUT-02b y repetir CP-EVT-01 y CP-EVT-02.
