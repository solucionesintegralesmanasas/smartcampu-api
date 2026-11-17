# Diagrama Entidad-Relación (ER) de UAJS Smart Campus

El modelo sale de las migraciones SQL en `scripts/migrations/` (`ms-*_001_init.sql`). Cada microservicio tiene su propia base de datos y no hay claves foráneas entre bases. Por eso hay dos tipos de relación:

- **Línea continua (`──`)**: clave foránea real dentro de la misma base de datos.
- **Línea punteada (`..`)**: referencia lógica entre servicios. Se guarda como `uuid` (`CHAR(36)`) más una columna desnormalizada con el nombre.

Notación de cardinalidad (crow's foot): `||` uno y solo uno, `|o` cero o uno, `o{` cero o muchos, `}o` uno o muchos.

## 1. Mapa general de dominios

```mermaid
erDiagram
    USUARIO }o--o{ ROL : "tiene (user_roles)"
    ROL }o--o{ PERMISO : "agrupa (role_permissions)"
    USUARIO }o--o{ PERMISO : "concesión directa (user_permissions)"
    SEDE ||..o{ RECURSO : "campus_uuid (lógica)"
    SEDE ||..o{ EVENTO : "campus_uuid (lógica)"
    RECURSO ||..o{ RESERVA : "resource_uuid (lógica)"
    USUARIO ||..o{ RESERVA : "requester_uuid (lógica)"
    USUARIO ||..o{ SOLICITUD : "requester_uuid (lógica)"
    USUARIO |o..o{ SOLICITUD : "assignee_uuid (lógica)"
    USUARIO ||..o{ EVENTO : "organizer_uuid (lógica)"
    USUARIO ||..o{ NOTIFICACION : "recipient_uuid (lógica)"
```

## 2. Identidad y RBAC (`uajs_auth` + `uajs_academic`)

```mermaid
erDiagram
    PERSONA |o--o{ USUARIO : "vincula (person_id, opcional)"
    USUARIO }o--o{ ROL : "user_roles (vigencia opcional)"
    ROL }o--o{ PERMISO : "role_permissions"
    USUARIO }o--o{ PERMISO : "user_permissions (concede o deniega)"
    USUARIO ||--o{ REFRESH_TOKEN : "posee"
    USUARIO ||--o{ TOKEN_VERIFICACION_EMAIL : "posee"
    PERSONA ||--o| ESTUDIANTE : "es"
    PERSONA ||--o| DOCENTE : "es"
    USUARIO |o..o| ESTUDIANTE : "user_uuid (lógica)"
    USUARIO |o..o| DOCENTE : "user_uuid (lógica)"

    PERSONA {
        int id PK
        uuid uuid UK
        string document_number UK "tipo + número"
        string first_name
        string last_name
        string email
    }
    USUARIO {
        int id PK
        uuid uuid UK
        int person_id FK "nullable"
        string email UK
        string password_hash
        bool is_active
        int failed_attempts
        timestamp locked_until
        timestamp deleted_at
    }
    ROL {
        int id PK
        uuid uuid UK
        string name UK "ADMIN, STUDENT, TEACHER..."
        bool is_system
    }
    PERMISO {
        int id PK
        uuid uuid UK
        string name UK "modulo.recurso.accion"
        string module
        string action
    }
    REFRESH_TOKEN {
        int id PK
        uuid uuid UK
        int user_id FK
        string token_hash UK
        uuid family_id
        timestamp expires_at
        timestamp revoked_at
    }
    TOKEN_VERIFICACION_EMAIL {
        int id PK
        int user_id FK
        string token_hash
        timestamp expires_at
        timestamp verified_at
    }
    ESTUDIANTE {
        int id PK
        uuid uuid UK
        int person_id FK "UK"
        string student_code UK
        string status
    }
    DOCENTE {
        int id PK
        uuid uuid UK
        int person_id FK "UK"
        string teacher_code UK
        string contract_type
    }
```

## 3. Recursos y reservas (`uajs_resources` + `uajs_bookings`)

```mermaid
erDiagram
    CATEGORIA_RECURSO ||--o{ RECURSO : "clasifica"
    ESTADO_RECURSO ||--o{ RECURSO : "estado actual"
    RECURSO ||--o{ HORARIO_RECURSO : "opera en (día de semana)"
    RECURSO ||--o{ BLOQUEO_RECURSO : "tiene indisponibilidad"
    RECURSO ||--o{ ITEM_INVENTARIO : "contiene"
    RECURSO ||..o{ RESERVA : "resource_uuid (lógica)"
    TIPO_RESERVA ||--o{ RESERVA : "tipifica"
    ESTADO_RESERVA ||--o{ RESERVA : "estado actual"
    RESERVA ||--o{ AUDITORIA_RESERVA : "registra transiciones"
    USUARIO ||..o{ RESERVA : "requester_uuid (lógica)"

    RECURSO {
        int id PK
        uuid uuid UK
        int category_id FK
        int status_id FK
        uuid campus_uuid "lógica"
        string code UK
        string name
        int capacity
        json attributes
        bool is_active
    }
    HORARIO_RECURSO {
        int id PK
        int resource_id FK
        int day_of_week "UK con resource_id"
        time open_time
        time close_time
    }
    BLOQUEO_RECURSO {
        int id PK
        int resource_id FK
        datetime starts_at
        datetime ends_at
        string reason
    }
    ITEM_INVENTARIO {
        int id PK
        int resource_id FK
        string description
        int quantity
        string condition_code
    }
    RESERVA {
        int id PK
        uuid uuid UK
        string reference_number UK "BK-2025-001234"
        int booking_type_id FK
        int status_id FK
        uuid resource_uuid "lógica"
        uuid requester_uuid "lógica"
        uuid approver_uuid "lógica, nullable"
        string title
        date booking_date
        time start_time
        time end_time
        timestamp approved_at
        timestamp cancelled_at
    }
    AUDITORIA_RESERVA {
        bigint id PK
        int booking_id FK
        int from_status_id FK
        int to_status_id FK
        uuid actor_uuid "lógica"
        timestamp occurred_at
    }
    TIPO_RESERVA {
        int id PK
        string code UK
        bool requires_approval
        int max_duration_minutes
    }
    ESTADO_RESERVA {
        int id PK
        string code UK "pending, approved, confirmed..."
        bool is_terminal
    }
    CATEGORIA_RECURSO {
        int id PK
        string code UK
        string name
    }
    ESTADO_RECURSO {
        int id PK
        string code UK "available, maintenance..."
        bool is_bookable
    }
```

## 4. Solicitudes (`uajs_requests`)

```mermaid
erDiagram
    CATEGORIA_SOLICITUD ||--o{ TIPO_SOLICITUD : "agrupa"
    TIPO_SOLICITUD ||--o{ SOLICITUD : "tipifica"
    ESTADO_SOLICITUD ||--o{ SOLICITUD : "estado actual"
    SOLICITUD ||--o{ COMENTARIO_SOLICITUD : "hilo de comentarios"
    SOLICITUD ||--o{ ADJUNTO_SOLICITUD : "adjunta"
    SOLICITUD ||--o{ AUDITORIA_SOLICITUD : "registra transiciones"
    USUARIO ||..o{ SOLICITUD : "requester_uuid (lógica)"
    USUARIO |o..o{ SOLICITUD : "assignee_uuid (lógica)"

    TIPO_SOLICITUD {
        int id PK
        int category_id FK
        string code UK
        string name
        bool requires_approval
        int sla_days
        decimal cost
        json form_schema
    }
    SOLICITUD {
        int id PK
        uuid uuid UK
        string ticket_number UK "REQ-2025-004321"
        int request_type_id FK
        int status_id FK
        uuid requester_uuid "lógica"
        string requester_name
        uuid assignee_uuid "lógica, nullable"
        string title
        text description
        json form_data
        date due_date
        timestamp resolved_at
    }
    COMENTARIO_SOLICITUD {
        int id PK
        int request_id FK
        uuid author_uuid "lógica"
        text body
        bool is_internal
    }
    ADJUNTO_SOLICITUD {
        int id PK
        int request_id FK
        uuid file_uuid "lógica, storage"
        string original_name
        string mime_type
        int size_bytes
    }
    AUDITORIA_SOLICITUD {
        bigint id PK
        int request_id FK
        int from_status_id FK
        int to_status_id FK
        uuid actor_uuid "lógica"
        timestamp occurred_at
    }
    ESTADO_SOLICITUD {
        int id PK
        string code UK "pending, in_review, approved, rejected, closed"
        bool is_terminal
    }
    CATEGORIA_SOLICITUD {
        int id PK
        string code UK
        string name
        int sort_order
    }
```

## 5. Eventos (`uajs_events`)

```mermaid
erDiagram
    CATEGORIA_EVENTO ||--o{ EVENTO : "clasifica"
    ESTADO_EVENTO ||--o{ EVENTO : "estado actual"
    EVENTO ||--o{ INSCRIPCION : "recibe"
    USUARIO ||..o{ EVENTO : "organizer_uuid (lógica)"
    USUARIO ||..o{ INSCRIPCION : "registrant_uuid (lógica)"
    SEDE ||..o{ EVENTO : "campus_uuid (lógica)"

    EVENTO {
        int id PK
        uuid uuid UK
        int category_id FK
        int status_id FK
        uuid organizer_uuid "lógica"
        uuid campus_uuid "lógica"
        string title
        string slug UK
        timestamp starts_at
        timestamp ends_at
        int max_capacity "NULL = ilimitado"
        decimal cost
        bool requires_registration
        timestamp registration_deadline
    }
    INSCRIPCION {
        int id PK
        uuid uuid UK
        int event_id FK "UK con registrant_uuid"
        uuid registrant_uuid "lógica"
        string status "pending, confirmed, waitlisted, cancelled, attended"
        timestamp registered_at
        timestamp attended_at
        string qr_code
    }
    ESTADO_EVENTO {
        int id PK
        string code UK "draft, published, ongoing, completed, cancelled"
        bool is_terminal
    }
    CATEGORIA_EVENTO {
        int id PK
        string code UK
        string name
    }
```

## 6. Notificaciones (`uajs_notifications`)

```mermaid
erDiagram
    PLANTILLA_NOTIFICACION |o--o{ NOTIFICACION : "genera (template_id, opcional)"
    USUARIO ||..o{ NOTIFICACION : "recipient_uuid (lógica)"
    USUARIO ||..o{ PREFERENCIA_NOTIFICACION : "user_uuid (lógica)"
    USUARIO ||..o{ SUSCRIPCION_PUSH : "user_uuid (lógica)"

    PLANTILLA_NOTIFICACION {
        int id PK
        string code UK "UK con channel, ej. booking.approved"
        string channel "in_app, email, push, sms"
        string subject
        text body_text
        json variables
    }
    NOTIFICACION {
        bigint id PK
        uuid uuid UK
        int template_id FK "nullable"
        uuid recipient_uuid "lógica"
        string channel
        string subject
        text body
        string source_service "polimórfica, sin FK"
        string source_entity "polimórfica, sin FK"
        uuid source_uuid "polimórfica, sin FK"
        string status "queued, sending, delivered, failed, read"
        timestamp read_at
        int retry_count
    }
    PREFERENCIA_NOTIFICACION {
        int id PK
        uuid user_uuid "lógica"
        string category "UK con user_uuid y channel"
        string channel
        bool is_enabled
    }
    SUSCRIPCION_PUSH {
        int id PK
        uuid uuid UK
        uuid user_uuid "lógica"
        string endpoint UK
        string device_type "web, android, ios"
        bool is_active
    }
```

## Puntos a tener en cuenta del modelo

1. **Cardinalidad de `USUARIO` a `PERSONA`**: `users.person_id` es nullable y no tiene restricción de unicidad, así que técnicamente una persona puede tener varios usuarios. En cambio, `estudiantes` y `docentes` sí tienen `person_id` único, por lo que la relación con `PERSONA` es 1:0..1.
2. **`PERSONA` aparece en dos bases**: la maestra está en `uajs_academic` y la instantánea mínima en `uajs_auth`. Solo la de `auth` se relaciona con `USUARIO`.
3. **Control de solapes en reservas**: `uq_bookings_slot (resource_uuid, booking_date, start_time)` solo impide reservas que empiezan a la misma hora. No detecta solapes parciales (por ejemplo, 9:00–11:00 y 10:00–12:00). Esa validación tiene que hacerse en la aplicación.
4. **Horarios por recurso**: `uq_resource_schedules_slot (resource_id, day_of_week)` permite una sola ventana operativa por día y recurso.
5. **Notificaciones polimórficas**: `source_service`, `source_entity` y `source_uuid` apuntan a cualquier entidad de cualquier servicio, sin FK. En el diagrama se marcan como "polimórfica".
6. **Fuera del diagrama**: PQRS (`uajs_pqrs`), almacenamiento (`uajs_storage`), empresas, catálogos geográficos y tokens de recuperación de contraseña.
