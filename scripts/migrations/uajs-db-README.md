# Arquitectura de bases de datos — UAJS Smart Campus

| Campo | Valor |
| --- | --- |
| **Autor** | Darwin Montes |
| **Versión del documento** | 1.1.0 |
| **Motor** | MySQL 8.0 |
| **Juego de caracteres** | `utf8mb4` / `utf8mb4_unicode_ci` |
| **Zona horaria** | UTC (`SET time_zone = '+00:00'`); conversión a `America/Bogota` en la capa de aplicación |
| **Última revisión** | 2026-10-24 |

---

## 1. Propósito y alcance

Este documento describe el modelo de datos del proyecto: qué base de datos pertenece a cada microservicio, cómo se relacionan entre sí y cómo se instalan los esquemas y las semillas.

Para información detallada consulta:

| Documento | Contenido |
| --- | --- |
| `docs/diagrama-er.md` | Diagramas entidad-relación por dominio |
| `docs/diccionario-de-datos.md` | Campos, tipos, claves y restricciones de cada tabla |
| `docs/matriz-propiedad-datos.md` | Qué servicio es dueño de cada dominio y por qué |
| `docs/guia-inicializacion.md` | Procedimiento paso a paso para levantar la base de datos y verificarla |

---

## 2. Principios de diseño

| Principio | Implementación |
| --- | --- |
| **Base de datos por servicio** | Cada microservicio tiene su propia base `uajs_*`. No hay tablas compartidas, salvo la excepción documentada entre `auth-service` y `user-service` (ver sección 10). |
| **Sin claves foráneas entre bases** | Las referencias entre servicios se guardan como `uuid` (`CHAR(36)`) más un campo desnormalizado con el nombre (*snapshot*). Los datos ajenos se obtienen por API REST o por eventos. |
| **Eliminación suave selectiva** | Solo las tablas que lo necesitan tienen `deleted_at`: `users`, `persons` (en `uajs_academic`), `students`, `teachers` y `request_comments`. Las demás usan `is_active` para desactivar registros. |
| **Trazabilidad de estados** | Las entidades con máquina de estados tienen una tabla `*_audit_trail` inmutable: reservas, solicitudes y PQRS. La autenticación registra sus eventos en `audit_logs`. |
| **Migraciones idempotentes** | Todas usan `CREATE DATABASE IF NOT EXISTS` y `CREATE TABLE IF NOT EXISTS`, por lo que pueden ejecutarse de nuevo sin error. |
| **Semillas idempotentes** | Usan `INSERT ... ON DUPLICATE KEY UPDATE` o `INSERT IGNORE`. |

---

## 3. Inventario de bases de datos

| Base de datos | Servicio propietario | Puerto | Tablas | Contenido |
| --- | --- | --- | --- | --- |
| `uajs_catalog` | catalog-service (3003) | 3003 | 4 | Países, departamentos, ciudades y tipos de documento. |
| `uajs_auth` | auth-service (3001) y user-service (3002) | 3001 / 3002 | 11 | Credenciales, tokens, RBAC (roles y permisos) y auditoría de seguridad. |
| `uajs_academic` | university-service (3004) | 3004 | 7 | Sedes, empresas, personas, facultades, programas, estudiantes y docentes. |
| `uajs_resources` | resource-service (3005) | 3005 | 6 | Recursos físicos, categorías, estados, horarios, bloqueos e inventario. |
| `uajs_bookings` | booking-service (3006) | 3006 | 4 | Reservas, tipos, estados y auditoría de transiciones. |
| `uajs_requests` | request-service (3007) | 3007 | 7 | Solicitudes, tipos, categorías, estados, comentarios, adjuntos y auditoría. |
| `uajs_events` | event-service (3008) | 3008 | 4 | Eventos, categorías, estados e inscripciones. |
| `uajs_notifications` | notification-service (3009) | 3009 | 4 | Notificaciones, plantillas, preferencias y suscripciones push. |
| `uajs_pqrs` | pqrs-service (3010) | 3010 | 6 | PQRS, tipos, estados, respuestas, adjuntos y auditoría. |
| `uajs_storage` | storage-service (3011) | 3011 | 1 | Metadatos de archivos. El contenido binario se guarda en disco o en el backend configurado. |

**Total: 10 bases de datos y 54 tablas.**

Además, Docker Compose crea la base `uajs_smart_campus`, que se usa como base por defecto del usuario de la aplicación y no contiene tablas del modelo.

---

## 4. Referencias entre servicios

Las referencias entre bases son lógicas: un campo `*_uuid` apunta a una entidad de otro servicio, sin FK física. Las principales son:

| Origen (base.tabla.campo) | Destino | Tipo |
| --- | --- | --- |
| `uajs_academic.campuses.city_uuid` | `uajs_catalog.cities.uuid` | Lógica, con snapshot `city_name` |
| `uajs_academic.persons.document_type_code` | `uajs_catalog.document_types.code` | Lógica |
| `uajs_auth.persons` | `uajs_academic.persons` | Copia mínima (snapshot) |
| `uajs_resources.resources.campus_uuid` | `uajs_academic.campuses.uuid` | Lógica, con snapshot `campus_name` |
| `uajs_bookings.bookings.resource_uuid` | `uajs_resources.resources.uuid` | Lógica, con snapshot `resource_name` |
| `uajs_bookings.bookings.requester_uuid` | `uajs_auth.users.uuid` | Lógica, con snapshot `requester_name` |
| `uajs_requests.requests.requester_uuid` | `uajs_auth.users.uuid` | Lógica, con snapshot `requester_name` |
| `uajs_requests.request_attachments.file_uuid` | `uajs_storage.files.uuid` | Lógica |
| `uajs_events.events.organizer_uuid` | `uajs_auth.users.uuid` | Lógica, con snapshot `organizer_name` |
| `uajs_events.events.campus_uuid` | `uajs_academic.campuses.uuid` | Lógica, con snapshot `campus_name` |
| `uajs_pqrs.pqrs.requester_uuid` | `uajs_auth.users.uuid` | Lógica, nulo si la PQRS es anónima |
| `uajs_notifications.notifications.recipient_uuid` | `uajs_auth.users.uuid` | Lógica |
| `uajs_notifications.notifications.source_*` | Cualquier entidad de origen | Polimórfica, sin FK |

Los eventos de dominio llegan a `uajs_notifications` por la cola `notification_events`. Cada servicio publica en su propia cola de auditoría (por ejemplo `booking_events`) y nunca en la cola de notificaciones de otro servicio.

---

## 5. Reglas de integración

Los servicios se comunican entre sí solo por tres mecanismos:

1. **API REST** para leer datos de otro dominio en tiempo real. Ejemplo: booking-service consulta la disponibilidad a resource-service.
2. **Eventos de dominio** por BullMQ para notificar cambios de estado de forma asíncrona. Ejemplo: booking-service publica `reserva_approved` y notification-service lo consume.
3. **Referencias por UUID** con un snapshot desnormalizado.

Ningún servicio escribe sobre tablas de otro. Ver `docs/matriz-propiedad-datos.md`.

---

## 6. Convenciones de nomenclatura

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Tabla | `snake_case`, plural, en inglés | `booking_audit_trail` |
| Clave primaria | `id` (`INT UNSIGNED`, o `BIGINT UNSIGNED` en auditorías) | `id` |
| Identificador público | `uuid` (`CHAR(36)`, por defecto `UUID()`) | `uuid` |
| Referencia a otro servicio | `<entidad>_uuid` | `requester_uuid` |
| Snapshot | `<entidad>_<campo>` | `requester_name` |
| Clave foránea | `<tabla_singular>_id` | `status_id` |
| Booleano | `is_<adjetivo>` | `is_active` |
| Marca de tiempo de evento | `<evento>_at` | `cancelled_at` |
| Unicidad | `uq_<tabla>_<columnas>` | `uq_bookings_slot` |
| Clave foránea (constraint) | `fk_<abreviatura>_<destino>` | `fk_bat_booking` |
| Índice | `idx_<tabla>_<columnas>` | `idx_events_dates` |
| Restricción CHECK | `chk_<tabla>_<descripción>` | `chk_bookings_time` |

---

## 7. Máquinas de estado

Los valores de la tabla siguen la especificación de las migraciones y las semillas.

### 7.1 Reserva (`uajs_bookings.booking_statuses`)

```
pending ──► approved ──► confirmed ──► completed
   │                        │
   └──► rejected            ├──► cancelled
                            └──► no_show
```

Estados: `pending`, `approved`, `rejected`, `confirmed`, `cancelled`, `completed`, `no_show`.
Estados terminales: `rejected`, `cancelled`, `completed`.

> `no_show` está definido en la migración comentada del catálogo, pero no tiene fila en la semilla `ms-bookings`.

### 7.2 Solicitud (`uajs_requests.request_statuses`)

```
pending ──► in_review ──► approved ──► closed
                │
                └──► rejected ──► closed
```

Estados: `pending`, `in_review`, `approved`, `rejected`, `closed`. Estado terminal: `closed`.

### 7.3 PQRS (`uajs_pqrs.pqrs_statuses`)

```
pending ──► in_review ──► responded ──► closed
```

Estados: `pending`, `in_review`, `responded`, `closed`. Estado terminal: `closed`.

### 7.4 Evento (`uajs_events.event_statuses`)

```
draft ──► published ──► ongoing ──► completed
                │
                └──► cancelled
```

Estados: `draft`, `published`, `ongoing`, `completed`, `cancelled`. Estados terminales: `completed`, `cancelled`.

---

## 8. Instalación de esquemas y semillas

El procedimiento completo, con comandos para Bash y PowerShell y resultados esperados, está en `docs/guia-inicializacion.md`. Resumen:

### 8.1 Migraciones

- **Docker Compose:** en el primer arranque con el volumen vacío, `infrastructure/docker/init/init-databases.sh` aplica en orden alfabético los archivos `scripts/migrations/ms-*_001_init.sql` y concede permisos al usuario `uajs_user`.
- **Kubernetes:** los archivos de migración se cargan en un ConfigMap (`mysql-migrations`) montado en `/docker-entrypoint-initdb.d` (ver `infrastructure/kubernetes/infra/mysql.yaml`).
- **Manual:** cualquier archivo `ms-*_001_init.sql` puede aplicarse con el cliente de MySQL. Como las migraciones son idempotentes, es seguro volver a ejecutarlas.

> **Nota:** el script de inicialización solo se ejecuta cuando el volumen de datos está vacío. Si ya existe, aplica las migraciones manualmente.

### 8.2 Semillas

Las semillas están en `scripts/seed/ms-*_001_seed.sql`. Deben ejecutarse en este orden:

| Orden | Semilla | Motivo |
| --- | --- | --- |
| 1 | `ms-catalog` | `ms-academic` consulta `uajs_catalog.cities`. |
| 2 | `ms-auth` | Roles y permisos base. Sin dependencias. |
| 3 | `ms-academic` | Sede principal, facultades y programas. |
| 4 | `ms-resources` | Categorías y estados de recursos. |
| 5 | `ms-bookings` | Tipos y estados de reserva. |
| 6 | `ms-requests` | Categorías, tipos y estados de solicitud. |
| 7 | `ms-events` | Categorías y estados de evento. |
| 8 | `ms-pqrs` | Tipos y estados de PQRS. |

No hay semillas para `uajs_notifications` ni `uajs_storage`. Las semillas de autenticación no crean usuarios: la primera cuenta se registra con datos reales mediante `auth-service`.

---

## 9. Verificación

Después de instalar el esquema y las semillas, confirma como mínimo:

| Verificación | Resultado esperado |
| --- | --- |
| Bases `uajs_*` existentes | 11 filas en `SHOW DATABASES LIKE 'uajs\_%'` (las 10 del modelo más `uajs_smart_campus`) |
| Tablas del modelo | 54 tablas en total |
| `uajs_catalog.cities` | 136 filas |
| `uajs_auth.roles` | 5 filas |
| `uajs_auth.users` | 0 filas (esperado) |
| Sedes con ciudad válida | 0 sedes sin ciudad en `uajs_catalog.cities` |

La lista completa de consultas está en la sección 6 de `docs/guia-inicializacion.md`.

---

## 10. Notas de diseño y limitaciones conocidas

1. **Solapes de reservas.** `uq_bookings_slot (resource_uuid, booking_date, start_time)` impide reservas que empiezan a la misma hora, pero no detecta solapes parciales (por ejemplo, 9:00–11:00 y 10:00–12:00). La validación de solapes debe hacerse en la aplicación.
2. **Un horario por día.** `uq_resource_schedules_slot (resource_id, day_of_week)` permite una sola ventana operativa por recurso y día.
3. **`persons` en dos bases.** `uajs_academic.persons` es el registro maestro. `uajs_auth.persons` es una copia mínima para vincular credenciales. Ambas tablas se escriben desde servicios distintos (ver `docs/matriz-propiedad-datos.md`).
4. **Autenticación y RBAC compartidos.** `auth-service` y `user-service` comparten `uajs_auth`. Es una excepción documentada: el primero gestiona credenciales y tokens, y el segundo administra cuentas, roles y permisos.
5. **Sedes duplicadas en el código.** La migración define `uajs_academic.campuses` como la fuente oficial de sedes. `catalog-service` escribe además una tabla `sedes` en español que no está en ninguna migración. Pendiente de resolver.
6. **`inventory_items` sin escritor.** La tabla existe en el modelo, pero ningún repositorio del código la escribe.
7. **Notificaciones polimórficas.** `notifications.source_service`, `source_entity` y `source_uuid` no tienen FK, porque pueden apuntar a entidades de cualquier servicio.
8. **Carpeta `scripts/legacy`.** Contiene material histórico que no se ejecuta ni se monta. No la uses para inicializar bases de datos.

---

## 11. Historial de cambios

| Versión | Fecha | Cambios |
| --- | --- | --- |
| 1.0.0 | — | Versión inicial del documento. |
| 1.1.0 | 2026-10-24 | Reescritura completa. Se corrigió la afirmación de `deleted_at` en todas las entidades, la referencia a Helm (reemplazada por el ConfigMap real) y las máquinas de estado de solicitudes y PQRS. Se añadieron inventario verificado con conteos, referencias entre servicios, procedimiento de instalación, verificación, limitaciones conocidas y enlaces a la documentación relacionada. Se eliminó la sección de despliegue con rutas y puertos incorrectos. |
