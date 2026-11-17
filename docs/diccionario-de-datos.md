# Diccionario de datos — UAJS Smart Campus

Este diccionario documenta todas las tablas de las 11 bases de datos del proyecto, según las migraciones SQL en `scripts/migrations/` (`ms-*_001_init.sql`). Cada base pertenece a un único microservicio.

## Convenciones

| Concepto | Convención |
| --- | --- |
| **PK** | Clave primaria. Casi todas las tablas usan `id` (`INT UNSIGNED AUTO_INCREMENT`). Las tablas de auditoría usan `BIGINT UNSIGNED`. |
| **UK** | Restricción de unicidad. Las restricciones compuestas se indican con el nombre de las columnas. |
| **FK** | Clave foránea real dentro de la misma base de datos, con la forma `tabla.columna`. |
| **Ref. lógica** | Referencia entre servicios. Se guarda como `uuid` (`CHAR(36)`) sin FK a otra base de datos. |
| **Snapshot** | Columna desnormalizada que guarda el nombre de la entidad externa en el momento de la operación. |
| **uuid** | Identificador público (`CHAR(36)`, por defecto `UUID()`). Se expone en la API. |
| **created_at / updated_at** | Fecha de creación y de última modificación (`TIMESTAMP`, UTC). |
| **is_active** | Registro activo (`1`) o inactivo (`0`). Se usa para desactivar sin borrar. |
| **deleted_at** | Eliminación suave (*soft delete*). Solo en las tablas que la declaran. |
| **Nulo** | Indica si la columna admite `NULL`. |

Los tipos `ENUM` muestran sus valores permitidos entre paréntesis. Las columnas `created_at`, `updated_at` y `uuid` se listan en cada tabla para que la consulta sea autosuficiente.

---

## 1. `uajs_catalog` — ms-catalog

Datos maestros compartidos. Ningún otro servicio escribe aquí.

### 1.1 `countries` — Países (ISO 3166-1)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| iso_code | CHAR(2) | UK | No | | Código ISO 3166-1 alpha-2 |
| iso_code_3 | CHAR(3) | | Sí | | Código ISO 3166-1 alpha-3 |
| name | VARCHAR(100) | UK | No | | Nombre oficial del país |
| phone_code | VARCHAR(10) | | Sí | | Prefijo telefónico internacional |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 1.2 `departments` — Departamentos / estados

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| country_id | INT UNSIGNED | FK → countries.id | No | ON DELETE RESTRICT | País al que pertenece |
| dane_code | VARCHAR(10) | | Sí | | Código DANE (Colombia) |
| name | VARCHAR(100) | UK (con country_id) | No | | Nombre del departamento |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 1.3 `cities` — Ciudades / municipios

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| state_id | INT UNSIGNED | FK → departments.id | No | ON DELETE RESTRICT | Departamento al que pertenece |
| dane_code | VARCHAR(10) | | Sí | | Código DANE (Colombia) |
| name | VARCHAR(100) | UK (con state_id) | No | | Nombre del municipio o ciudad |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 1.4 `document_types` — Tipos de documento de identidad

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(10) | UK | No | | Código abreviado (CC, TI, NIT, CE, PAS) |
| name | VARCHAR(50) | UK | No | | Nombre del tipo de documento |
| requires_check_digit | TINYINT(1) | | No | DEFAULT 0 | Requiere dígito de verificación |
| applies_to_natural_person | TINYINT(1) | | No | DEFAULT 1 | Aplica a personas naturales |
| applies_to_legal_entity | TINYINT(1) | | No | DEFAULT 0 | Aplica a personas jurídicas |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

---

## 2. `uajs_academic` — ms-academic

Dominio académico. Las referencias a otros servicios usan `uuid` y snapshots, sin FK entre bases.

### 2.1 `campuses` — Sedes físicas

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| name | VARCHAR(100) | UK | No | | Nombre de la sede |
| address | VARCHAR(200) | | Sí | | Dirección física |
| phone | VARCHAR(20) | | Sí | | Teléfono de contacto |
| email | VARCHAR(100) | | Sí | | Correo de contacto |
| city_uuid | CHAR(36) | Ref. lógica → catalog.cities.uuid | No | | Ciudad de la sede |
| city_name | VARCHAR(100) | Snapshot | No | | Nombre de la ciudad |
| state_name | VARCHAR(100) | Snapshot | No | | Nombre del departamento |
| is_main | TINYINT(1) | | No | DEFAULT 0 | Es la sede principal |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 2.2 `companies` — Empresas externas (convenios, pasantías)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| legal_name | VARCHAR(200) | | No | | Razón social |
| trade_name | VARCHAR(200) | | Sí | | Nombre comercial |
| tax_id | VARCHAR(20) | UK | No | | NIT |
| check_digit | CHAR(1) | | Sí | | Dígito de verificación |
| address | VARCHAR(200) | | Sí | | Dirección física |
| phone | VARCHAR(20) | | Sí | | Teléfono de contacto |
| email | VARCHAR(100) | | Sí | | Correo de contacto |
| city_uuid | CHAR(36) | Ref. lógica → catalog.cities.uuid | Sí | | Ciudad de la empresa |
| city_name | VARCHAR(100) | Snapshot | Sí | | Nombre de la ciudad |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 2.3 `persons` — Personas naturales (registro maestro)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| document_type_code | VARCHAR(10) | UK (con document_number) | No | Ref. lógica → catalog.document_types.code | Tipo de documento |
| document_number | VARCHAR(30) | UK (con document_type_code) | No | | Número de documento |
| check_digit | CHAR(1) | | Sí | | Dígito de verificación |
| first_name | VARCHAR(50) | | No | | Primer nombre |
| middle_name | VARCHAR(50) | | Sí | | Segundo nombre |
| last_name | VARCHAR(50) | | No | | Primer apellido |
| second_last_name | VARCHAR(50) | | Sí | | Segundo apellido |
| date_of_birth | DATE | | Sí | | Fecha de nacimiento |
| gender | ENUM('M','F','X') | | Sí | | M=Masculino, F=Femenino, X=No binario |
| email | VARCHAR(150) | IDX | Sí | | Correo electrónico |
| phone | VARCHAR(20) | | Sí | | Teléfono de contacto |
| address | VARCHAR(200) | | Sí | | Dirección de residencia |
| city_uuid | CHAR(36) | Ref. lógica → catalog.cities.uuid | Sí | | Ciudad de residencia |
| city_name | VARCHAR(100) | Snapshot | Sí | | Nombre de la ciudad |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |
| deleted_at | TIMESTAMP | | Sí | | Eliminación suave |

### 2.4 `faculties` — Facultades

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| campus_id | INT UNSIGNED | FK → campuses.id | No | ON DELETE RESTRICT | Sede a la que pertenece |
| code | VARCHAR(20) | UK | No | | Código abreviado |
| name | VARCHAR(150) | UK | No | | Nombre de la facultad |
| dean_name | VARCHAR(100) | | Sí | | Nombre del decano |
| email | VARCHAR(100) | | Sí | | Correo de contacto |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 2.5 `programs` — Programas académicos

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| faculty_id | INT UNSIGNED | FK → faculties.id | No | ON DELETE RESTRICT | Facultad a la que pertenece |
| code | VARCHAR(20) | UK | No | | Código abreviado |
| name | VARCHAR(150) | UK | No | | Nombre del programa |
| level | ENUM | | No | undergraduate, specialization, masters, doctorate, technologist, technician | Nivel de formación |
| duration_semesters | TINYINT UNSIGNED | | No | | Duración en semestres |
| total_credits | SMALLINT UNSIGNED | | No | | Total de créditos |
| snies_code | VARCHAR(20) | | Sí | | Código SNIES (MEN Colombia) |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 2.6 `students` — Estudiantes

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| person_id | INT UNSIGNED | FK → persons.id, UK | No | ON DELETE RESTRICT | Persona natural asociada (una persona = un estudiante) |
| program_id | INT UNSIGNED | FK → programs.id | No | ON DELETE RESTRICT | Programa en el que está matriculado |
| user_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | Sí | | Cuenta de acceso |
| student_code | VARCHAR(20) | UK | No | | Código de estudiante |
| enrollment_date | DATE | | No | | Fecha de matrícula |
| graduation_date | DATE | | Sí | | Fecha de graduación |
| current_semester | TINYINT UNSIGNED | | Sí | | Semestre actual |
| gpa | DECIMAL(4,2) | | Sí | | Promedio acumulado |
| status | ENUM | | No | DEFAULT 'active': active, inactive, graduated, withdrawn, suspended | Estado académico |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |
| deleted_at | TIMESTAMP | | Sí | | Eliminación suave |

### 2.7 `teachers` — Docentes

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| person_id | INT UNSIGNED | FK → persons.id, UK | No | ON DELETE RESTRICT | Persona natural asociada |
| faculty_id | INT UNSIGNED | FK → faculties.id | No | ON DELETE RESTRICT | Facultad del docente |
| user_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | Sí | | Cuenta de acceso |
| teacher_code | VARCHAR(20) | UK | No | | Código de docente |
| contract_type | ENUM | | No | full_time, part_time, visiting, honorary | Tipo de contratación |
| hire_date | DATE | | No | | Fecha de contratación |
| termination_date | DATE | | Sí | | Fecha de terminación |
| academic_degree | VARCHAR(80) | | Sí | | Título académico más alto |
| status | ENUM | | No | DEFAULT 'active': active, inactive, retired | Estado |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |
| deleted_at | TIMESTAMP | | Sí | | Eliminación suave |

---

## 3. `uajs_auth` — ms-auth

Única fuente de verdad de la identidad. Solo aquí se emiten los JWT.

### 3.1 `persons` — Instantánea mínima de la persona

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| document_type_code | VARCHAR(10) | UK (con document_number) | No | Ref. lógica → catalog.document_types.code | Tipo de documento |
| document_number | VARCHAR(30) | UK (con document_type_code) | No | | Número de documento |
| check_digit | CHAR(1) | | Sí | | Dígito de verificación |
| first_name | VARCHAR(50) | | No | | Primer nombre |
| middle_name | VARCHAR(50) | | Sí | | Segundo nombre |
| last_name | VARCHAR(50) | | No | | Primer apellido |
| second_last_name | VARCHAR(50) | | Sí | | Segundo apellido |
| email | VARCHAR(150) | | Sí | | Correo electrónico |
| phone | VARCHAR(20) | | Sí | | Teléfono |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 3.2 `users` — Cuentas de usuario

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| person_id | INT UNSIGNED | FK → persons.id | Sí | ON DELETE SET NULL | Persona natural asociada |
| email | VARCHAR(150) | UK | No | | Correo de acceso |
| password_hash | VARCHAR(255) | | No | | Hash bcrypt ($2b$12$) |
| email_verified_at | TIMESTAMP | | Sí | | Fecha de verificación del correo |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Cuenta activa |
| last_login_at | TIMESTAMP | | Sí | | Último inicio de sesión |
| last_login_ip | VARCHAR(45) | | Sí | | IP del último inicio de sesión |
| failed_attempts | TINYINT UNSIGNED | | No | DEFAULT 0 | Intentos fallidos consecutivos |
| locked_until | TIMESTAMP | | Sí | | Bloqueo temporal hasta esta fecha |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |
| deleted_at | TIMESTAMP | | Sí | | Eliminación suave |

### 3.3 `roles` — Roles RBAC

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| name | VARCHAR(50) | UK (con guard_name) | No | | Nombre del rol (ADMIN, STUDENT, TEACHER...) |
| guard_name | VARCHAR(50) | UK (con name) | No | DEFAULT 'api' | Guard de autenticación |
| description | VARCHAR(255) | | Sí | | Descripción |
| is_system | TINYINT(1) | | No | DEFAULT 0 | Rol de sistema (no eliminable) |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 3.4 `permissions` — Permisos de grano fino

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| name | VARCHAR(100) | UK (con guard_name) | No | | Convención `modulo.recurso.accion` |
| guard_name | VARCHAR(50) | UK (con name) | No | DEFAULT 'api' | Guard de autenticación |
| module | VARCHAR(50) | IDX | No | | Módulo propietario |
| resource | VARCHAR(50) | | No | | Entidad protegida |
| action | VARCHAR(30) | | No | | create, read, update, delete, approve, export |
| description | VARCHAR(255) | | Sí | | Descripción |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 3.5 `role_permissions` — Rol ↔ Permiso (N:M)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| role_id | INT UNSIGNED | PK (compuesta), FK → roles.id | No | ON DELETE CASCADE | Rol |
| permission_id | INT UNSIGNED | PK (compuesta), FK → permissions.id | No | ON DELETE CASCADE | Permiso asignado |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de asignación |

### 3.6 `user_roles` — Usuario ↔ Rol (N:M)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| user_id | INT UNSIGNED | PK (compuesta), FK → users.id | No | ON DELETE CASCADE | Usuario |
| role_id | INT UNSIGNED | PK (compuesta), FK → roles.id | No | ON DELETE CASCADE | Rol asignado |
| assigned_by | INT UNSIGNED | | Sí | | user_id de quien asignó el rol |
| assigned_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de asignación |
| expires_at | TIMESTAMP | | Sí | | Vigencia opcional del rol |

### 3.7 `user_permissions` — Concesiones directas

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| user_id | INT UNSIGNED | PK (compuesta), FK → users.id | No | ON DELETE CASCADE | Usuario |
| permission_id | INT UNSIGNED | PK (compuesta), FK → permissions.id | No | ON DELETE CASCADE | Permiso |
| granted | TINYINT(1) | | No | DEFAULT 1 | 1 = conceder, 0 = denegar (la denegación prevalece) |
| assigned_by | INT UNSIGNED | | Sí | | user_id de quien asignó |
| assigned_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de asignación |
| expires_at | TIMESTAMP | | Sí | | Vencimiento opcional |

### 3.8 `refresh_tokens` — Tokens de refresco

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| user_id | INT UNSIGNED | FK → users.id, IDX | No | ON DELETE CASCADE | Propietario del token |
| token_hash | VARCHAR(255) | UK | No | | SHA-256 del token (nunca el crudo) |
| family_id | CHAR(36) | IDX | No | | Familia de rotación (detección de robo) |
| device_info | VARCHAR(255) | | Sí | | User-Agent |
| ip_address | VARCHAR(45) | | Sí | | IP de origen |
| issued_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de emisión |
| expires_at | TIMESTAMP | IDX | No | | Fecha de expiración |
| revoked_at | TIMESTAMP | | Sí | | Fecha de revocación |
| revoke_reason | VARCHAR(50) | | Sí | | logout, rotation, theft, admin |

### 3.9 `password_reset_tokens` — Recuperación de contraseña

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| email | VARCHAR(150) | IDX | No | | Correo del solicitante (sin FK) |
| token_hash | VARCHAR(255) | | No | | SHA-256 del OTP |
| expires_at | TIMESTAMP | IDX | No | | Fecha de expiración |
| used_at | TIMESTAMP | | Sí | | Fecha de uso (un solo uso) |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |

### 3.10 `email_verification_tokens` — Verificación de correo

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| user_id | INT UNSIGNED | FK → users.id, IDX | No | ON DELETE CASCADE | Usuario propietario |
| token_hash | VARCHAR(255) | | No | | Hash del token |
| expires_at | TIMESTAMP | IDX | No | | Fecha de expiración |
| verified_at | TIMESTAMP | | Sí | | Fecha de verificación efectiva |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |

### 3.11 `audit_logs` — Auditoría de seguridad (inmutable)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| user_id | INT UNSIGNED | IDX | Sí | | Usuario (NULL en intentos no autenticados) |
| event | VARCHAR(60) | IDX | No | | login.success, login.failed, logout, password.reset, token.rotated, role.assigned |
| ip_address | VARCHAR(45) | | Sí | | IP de origen |
| user_agent | TEXT | | Sí | | User-Agent |
| metadata | JSON | | Sí | | Carga útil del evento |
| occurred_at | TIMESTAMP | IDX | No | DEFAULT CURRENT_TIMESTAMP | Fecha del evento |

---

## 4. `uajs_resources` — ms-resources

### 4.1 `resource_categories` — Categorías de recursos

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | Código abreviado |
| name | VARCHAR(50) | UK | No | | Nombre (aula, laboratorio, vehículo...) |
| icon | VARCHAR(60) | | Sí | | Icono (lucide / font-awesome) |
| description | TEXT | | Sí | | Descripción |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 4.2 `resource_statuses` — Estados operativos

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | available, maintenance, out_of_service, reserved |
| name | VARCHAR(50) | | No | | Nombre legible |
| is_bookable | TINYINT(1) | | No | DEFAULT 1 | Permite reservas en este estado |
| color_hex | CHAR(7) | | Sí | | Color de la insignia |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 4.3 `resources` — Recursos físicos reservables

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| category_id | INT UNSIGNED | FK → resource_categories.id, IDX | No | ON DELETE RESTRICT | Categoría |
| status_id | INT UNSIGNED | FK → resource_statuses.id, IDX | No | ON DELETE RESTRICT | Estado operativo actual |
| campus_uuid | CHAR(36) | Ref. lógica → academic.campuses.uuid, IDX | No | | Sede donde está el recurso |
| campus_name | VARCHAR(100) | Snapshot | No | | Nombre de la sede |
| code | VARCHAR(30) | UK | No | | Código abreviado |
| name | VARCHAR(100) | | No | | Nombre del recurso |
| description | TEXT | | Sí | | Descripción |
| capacity | INT UNSIGNED | | Sí | | Capacidad máxima de personas |
| floor | VARCHAR(10) | | Sí | | Piso |
| building | VARCHAR(50) | | Sí | | Edificio |
| has_inventory | TINYINT(1) | | No | DEFAULT 0 | Maneja inventario |
| attributes | JSON | | Sí | | Características (proyector, AC, WiFi...) |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 4.4 `resource_schedules` — Horario operativo semanal

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| resource_id | INT UNSIGNED | FK → resources.id, UK (con day_of_week) | No | ON DELETE CASCADE | Recurso |
| day_of_week | TINYINT UNSIGNED | UK (con resource_id) | No | | 0 = Domingo … 6 = Sábado |
| open_time | TIME | | No | CHECK close_time > open_time (en la fila) | Hora de apertura |
| close_time | TIME | | No | | Hora de cierre |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Programación activa |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 4.5 `resource_blackouts` — Cierres excepcionales

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| resource_id | INT UNSIGNED | FK → resources.id, IDX | No | ON DELETE CASCADE | Recurso afectado |
| starts_at | DATETIME | | No | CHECK ends_at > starts_at | Inicio del bloqueo |
| ends_at | DATETIME | | No | | Fin del bloqueo |
| reason | VARCHAR(200) | | No | | Motivo |
| created_by_uuid | CHAR(36) | Ref. lógica → auth.users.uuid | No | | Quién creó el bloqueo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 4.6 `inventory_items` — Elementos de inventario

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| resource_id | INT UNSIGNED | FK → resources.id, IDX | No | ON DELETE RESTRICT | Recurso que contiene el elemento |
| serial_number | VARCHAR(80) | | Sí | | Número de serie |
| description | VARCHAR(200) | | No | | Descripción del elemento |
| quantity | INT UNSIGNED | | No | DEFAULT 1 | Cantidad |
| unit | VARCHAR(20) | | No | DEFAULT 'unit' | Unidad de medida |
| condition_code | ENUM | | No | DEFAULT 'good': new, good, fair, damaged, decommissioned | Condición física |
| acquired_at | DATE | | Sí | | Fecha de adquisición |
| attributes | JSON | | Sí | | Atributos adicionales |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

---

## 5. `uajs_bookings` — ms-bookings

### 5.1 `booking_types` — Tipos de reserva

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | Código abreviado |
| name | VARCHAR(50) | | No | | Nombre del tipo |
| description | TEXT | | Sí | | Descripción |
| requires_approval | TINYINT(1) | | No | DEFAULT 1 | Requiere aprobación |
| max_duration_minutes | INT UNSIGNED | | Sí | | Duración máxima en minutos (NULL = ilimitada) |
| advance_days_limit | SMALLINT UNSIGNED | | Sí | | Días máximos de antelación |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 5.2 `booking_statuses` — Estados de la reserva

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | pending, approved, rejected, confirmed, cancelled, completed, no_show |
| name | VARCHAR(50) | | No | | Nombre legible |
| is_terminal | TINYINT(1) | | No | DEFAULT 0 | Estado final |
| color_hex | CHAR(7) | | Sí | | Color de la insignia |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 5.3 `bookings` — Reservas

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| reference_number | VARCHAR(20) | UK | No | | Número legible, ej. BK-2025-001234 |
| booking_type_id | INT UNSIGNED | FK → booking_types.id, IDX | No | ON DELETE RESTRICT | Tipo de reserva |
| status_id | INT UNSIGNED | FK → booking_statuses.id, IDX | No | ON DELETE RESTRICT | Estado actual |
| resource_uuid | CHAR(36) | Ref. lógica → resources.resources.uuid, IDX, UK (con booking_date y start_time) | No | | Recurso reservado |
| resource_name | VARCHAR(100) | Snapshot | No | | Nombre del recurso |
| requester_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | No | | Solicitante |
| requester_name | VARCHAR(120) | Snapshot | No | | Nombre del solicitante |
| approver_uuid | CHAR(36) | Ref. lógica → auth.users.uuid | Sí | | Aprobador |
| title | VARCHAR(200) | | No | | Título |
| description | TEXT | | Sí | | Descripción |
| booking_date | DATE | UK (con resource_uuid y start_time), IDX | No | | Fecha de la reserva |
| start_time | TIME | UK (con resource_uuid y booking_date) | No | | Hora de inicio |
| end_time | TIME | | No | CHECK end_time > start_time | Hora de fin |
| requested_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de solicitud |
| approved_at | TIMESTAMP | | Sí | | Fecha de aprobación |
| cancelled_at | TIMESTAMP | | Sí | | Fecha de cancelación |
| completed_at | TIMESTAMP | | Sí | | Fecha de cierre |
| cancellation_reason | TEXT | | Sí | | Motivo de cancelación |
| expected_attendees | SMALLINT UNSIGNED | | Sí | | Asistentes esperados |
| metadata | JSON | | Sí | | Metadatos adicionales |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 5.4 `booking_audit_trail` — Auditoría de transiciones (inmutable)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| booking_id | INT UNSIGNED | FK → bookings.id, IDX | No | ON DELETE CASCADE | Reserva afectada |
| from_status_id | INT UNSIGNED | FK → booking_statuses.id, IDX | Sí | ON DELETE SET NULL | Estado anterior |
| to_status_id | INT UNSIGNED | FK → booking_statuses.id, IDX | No | ON DELETE RESTRICT | Estado nuevo |
| actor_uuid | CHAR(36) | Ref. lógica → auth.users.uuid | No | | Quién hizo la transición |
| actor_name | VARCHAR(120) | Snapshot | No | | Nombre del actor |
| comment | TEXT | | Sí | | Comentario |
| occurred_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de la transición |

---

## 6. `uajs_requests` — ms-requests

### 6.1 `request_categories` — Categorías de solicitudes

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | Código abreviado |
| name | VARCHAR(80) | | No | | Nombre de la categoría |
| icon | VARCHAR(60) | | Sí | | Icono |
| sort_order | SMALLINT UNSIGNED | | No | DEFAULT 0 | Orden de visualización |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 6.2 `request_types` — Tipos de solicitud (SLA y formulario)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| category_id | INT UNSIGNED | FK → request_categories.id, IDX | No | ON DELETE RESTRICT | Categoría |
| code | VARCHAR(20) | UK | No | | Código abreviado |
| name | VARCHAR(80) | | No | | Nombre del tipo |
| description | TEXT | | Sí | | Descripción |
| requires_approval | TINYINT(1) | | No | DEFAULT 1 | Requiere aprobación |
| sla_days | SMALLINT UNSIGNED | | Sí | | SLA en días hábiles |
| cost | DECIMAL(12,2) | | Sí | | Costo en COP (NULL = gratuito) |
| form_schema | JSON | | Sí | | Definición de campos dinámicos |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 6.3 `request_statuses` — Estados de la solicitud

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | pending, in_review, approved, rejected, closed |
| name | VARCHAR(50) | | No | | Nombre legible |
| is_terminal | TINYINT(1) | | No | DEFAULT 0 | Estado final |
| color_hex | CHAR(7) | | Sí | | Color de la insignia |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 6.4 `requests` — Solicitudes / tickets

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| ticket_number | VARCHAR(20) | UK | No | | Número de ticket, ej. REQ-2025-004321 |
| request_type_id | INT UNSIGNED | FK → request_types.id, IDX | No | ON DELETE RESTRICT | Tipo de solicitud |
| status_id | INT UNSIGNED | FK → request_statuses.id, IDX | No | ON DELETE RESTRICT | Estado actual |
| requester_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | No | | Solicitante |
| requester_name | VARCHAR(120) | Snapshot | No | | Nombre del solicitante |
| assignee_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | Sí | | Personal asignado |
| assignee_name | VARCHAR(120) | Snapshot | Sí | | Nombre del asignado |
| title | VARCHAR(200) | | No | | Título |
| description | TEXT | | No | | Descripción |
| form_data | JSON | | Sí | | Respuestas del formulario dinámico |
| resolution_notes | TEXT | | Sí | | Notas de resolución |
| due_date | DATE | IDX | Sí | | Fecha límite calculada desde el SLA |
| resolved_at | TIMESTAMP | | Sí | | Fecha de resolución |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 6.5 `request_comments` — Comentarios de la solicitud

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| request_id | INT UNSIGNED | FK → requests.id, IDX | No | ON DELETE CASCADE | Solicitud |
| author_uuid | CHAR(36) | Ref. lógica → auth.users.uuid | No | | Autor |
| author_name | VARCHAR(120) | Snapshot | No | | Nombre del autor |
| body | TEXT | | No | | Contenido |
| is_internal | TINYINT(1) | | No | DEFAULT 0 | Nota interna (no visible para el solicitante) |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |
| deleted_at | TIMESTAMP | | Sí | | Eliminación suave |

### 6.6 `request_attachments` — Adjuntos de la solicitud

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| request_id | INT UNSIGNED | FK → requests.id, IDX | No | ON DELETE CASCADE | Solicitud |
| uploader_uuid | CHAR(36) | Ref. lógica → auth.users.uuid | No | | Quién subió el archivo |
| file_uuid | CHAR(36) | Ref. lógica → storage.files.uuid | No | | Archivo en el almacenamiento |
| original_name | VARCHAR(255) | | No | | Nombre original |
| mime_type | VARCHAR(100) | | No | | Tipo MIME |
| size_bytes | INT UNSIGNED | | No | | Tamaño en bytes |
| uploaded_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de carga |

### 6.7 `request_audit_trail` — Auditoría de transiciones (inmutable)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| request_id | INT UNSIGNED | FK → requests.id, IDX | No | ON DELETE CASCADE | Solicitud afectada |
| from_status_id | INT UNSIGNED | FK → request_statuses.id, IDX | Sí | ON DELETE SET NULL | Estado anterior |
| to_status_id | INT UNSIGNED | FK → request_statuses.id, IDX | No | ON DELETE RESTRICT | Estado nuevo |
| actor_uuid | CHAR(36) | Ref. lógica → auth.users.uuid | No | | Actor |
| actor_name | VARCHAR(120) | Snapshot | No | | Nombre del actor |
| comment | TEXT | | Sí | | Comentario |
| occurred_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de la transición |

---

## 7. `uajs_events` — ms-events

### 7.1 `event_categories` — Categorías de eventos

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | Código abreviado |
| name | VARCHAR(50) | | No | | Nombre |
| color_hex | CHAR(7) | | Sí | | Color del calendario |
| icon | VARCHAR(60) | | Sí | | Icono |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 7.2 `event_statuses` — Estados del evento

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | draft, published, ongoing, completed, cancelled |
| name | VARCHAR(50) | | No | | Nombre legible |
| is_terminal | TINYINT(1) | | No | DEFAULT 0 | Estado final |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 7.3 `events` — Eventos universitarios

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| category_id | INT UNSIGNED | FK → event_categories.id, IDX | No | ON DELETE RESTRICT | Categoría |
| status_id | INT UNSIGNED | FK → event_statuses.id, IDX | No | ON DELETE RESTRICT | Estado actual |
| organizer_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | No | | Organizador |
| organizer_name | VARCHAR(120) | Snapshot | No | | Nombre del organizador |
| campus_uuid | CHAR(36) | Ref. lógica → academic.campuses.uuid, IDX | No | | Sede del evento |
| campus_name | VARCHAR(100) | Snapshot | No | | Nombre de la sede |
| title | VARCHAR(200) | | No | | Título |
| slug | VARCHAR(220) | UK | Sí | | Identificador compatible con URL |
| description | TEXT | | Sí | | Descripción |
| venue | VARCHAR(200) | | Sí | | Salón o ubicación dentro de la sede |
| starts_at | TIMESTAMP | IDX (con ends_at) | No | | Inicio |
| ends_at | TIMESTAMP | IDX (con starts_at) | No | CHECK ends_at > starts_at | Fin |
| max_capacity | INT UNSIGNED | | Sí | | Aforo máximo (NULL = ilimitado) |
| cost | DECIMAL(12,2) | | No | DEFAULT 0.00 | Costo en COP |
| requires_registration | TINYINT(1) | | No | DEFAULT 0 | Requiere inscripción previa |
| registration_deadline | TIMESTAMP | | Sí | | Fecha límite de inscripción |
| cover_image_uuid | CHAR(36) | Ref. lógica → storage.files.uuid | Sí | | Imagen de portada |
| metadata | JSON | | Sí | | Metadatos adicionales |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 7.4 `event_registrations` — Inscripciones a eventos

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| event_id | INT UNSIGNED | FK → events.id, UK (con registrant_uuid) | No | ON DELETE CASCADE | Evento |
| registrant_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, UK (con event_id), IDX | No | | Participante |
| registrant_name | VARCHAR(120) | Snapshot | No | | Nombre del inscrito |
| status | ENUM | | No | DEFAULT 'pending': pending, confirmed, waitlisted, cancelled, attended | Estado de la inscripción |
| registered_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de inscripción |
| confirmed_at | TIMESTAMP | | Sí | | Fecha de confirmación |
| cancelled_at | TIMESTAMP | | Sí | | Fecha de cancelación |
| attended_at | TIMESTAMP | | Sí | | Fecha de check-in |
| qr_code | VARCHAR(255) | | Sí | | Carga útil del código QR |
| notes | TEXT | | Sí | | Notas |

---

## 8. `uajs_notifications` — ms-notifications

### 8.1 `notification_templates` — Plantillas

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(60) | UK (con channel) | No | | Código, ej. booking.approved |
| name | VARCHAR(100) | | No | | Nombre descriptivo |
| channel | ENUM | UK (con code) | No | in_app, email, push, sms | Canal de envío |
| subject | VARCHAR(200) | | Sí | | Asunto (admite interpolación) |
| body_text | TEXT | | Sí | | Cuerpo en texto plano |
| body_html | MEDIUMTEXT | | Sí | | Cuerpo HTML (solo correo) |
| variables | JSON | | Sí | | Variables esperadas y sus tipos |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 8.2 `notifications` — Notificaciones enviadas

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| template_id | INT UNSIGNED | FK → notification_templates.id, IDX | Sí | ON DELETE SET NULL | Plantilla usada (NULL = ad hoc) |
| recipient_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | No | | Destinatario |
| recipient_email | VARCHAR(150) | | Sí | | Correo del destinatario |
| channel | ENUM | | No | in_app, email, push, sms | Canal |
| subject | VARCHAR(200) | | Sí | | Asunto |
| body | TEXT | | No | | Cuerpo |
| source_service | VARCHAR(50) | IDX (compuesto) | Sí | | Servicio origen (polimórfica, sin FK) |
| source_entity | VARCHAR(50) | IDX (compuesto) | Sí | | Entidad origen (polimórfica, sin FK) |
| source_uuid | CHAR(36) | IDX (compuesto) | Sí | | UUID de la entidad desencadenante (sin FK) |
| status | ENUM | IDX | No | DEFAULT 'queued': queued, sending, delivered, failed, read | Estado de entrega |
| queued_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de encolado |
| sent_at | TIMESTAMP | | Sí | | Fecha de envío |
| delivered_at | TIMESTAMP | | Sí | | Fecha de entrega |
| read_at | TIMESTAMP | | Sí | | Fecha de lectura |
| failed_at | TIMESTAMP | | Sí | | Fecha de fallo |
| failure_reason | VARCHAR(500) | | Sí | | Motivo del fallo |
| retry_count | TINYINT UNSIGNED | | No | DEFAULT 0 | Reintentos realizados |
| metadata | JSON | | Sí | | Metadatos adicionales |

### 8.3 `user_notification_preferences` — Preferencias por usuario

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| user_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, UK (con category y channel) | No | | Usuario |
| category | VARCHAR(60) | UK (con user_uuid y channel) | No | | Prefijo de la plantilla (ej. booking) |
| channel | ENUM | UK (con user_uuid y category) | No | in_app, email, push, sms | Canal |
| is_enabled | TINYINT(1) | | No | DEFAULT 1 | Canal habilitado |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 8.4 `push_subscriptions` — Dispositivos para push

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| user_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | No | | Usuario dueño del dispositivo |
| endpoint | VARCHAR(500) | UK | No | | URL del endpoint de push |
| auth_key | VARCHAR(255) | | No | | Clave VAPID auth (cifrada en reposo) |
| p256dh_key | VARCHAR(255) | | No | | Clave VAPID p256dh (cifrada en reposo) |
| device_type | ENUM | | No | DEFAULT 'web': web, android, ios | Tipo de dispositivo |
| device_label | VARCHAR(100) | | Sí | | Etiqueta del dispositivo |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Suscripción activa |
| last_used_at | TIMESTAMP | | Sí | | Último uso |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

---

## 9. `uajs_pqrs` — ms-pqrs

### 9.1 `pqrs_types` — Tipos de PQRS

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | PETICION, QUEJA, RECLAMO, SUGERENCIA, FELICITACION |
| name | VARCHAR(80) | | No | | Nombre legible |
| description | TEXT | | Sí | | Descripción |
| sla_days | SMALLINT UNSIGNED | | No | DEFAULT 15 | Plazo de respuesta en días hábiles |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 9.2 `pqrs_statuses` — Estados de la PQRS

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| code | VARCHAR(20) | UK | No | | pending, in_review, responded, closed |
| name | VARCHAR(50) | | No | | Nombre legible |
| is_terminal | TINYINT(1) | | No | DEFAULT 0 | Estado final |
| color_hex | CHAR(7) | | Sí | | Color de la insignia |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 9.3 `pqrs` — Peticiones, quejas, reclamos y sugerencias

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| ticket_number | VARCHAR(20) | UK | No | | Número de radicado, ej. PQRS-2025-004321 |
| type_id | INT UNSIGNED | FK → pqrs_types.id, IDX | No | ON DELETE RESTRICT | Tipo de PQRS |
| status_id | INT UNSIGNED | FK → pqrs_statuses.id, IDX | No | ON DELETE RESTRICT | Estado actual |
| is_anonymous | TINYINT(1) | | No | DEFAULT 0 | Radicada de forma anónima |
| requester_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | Sí | | Solicitante (NULL si es anónima) |
| requester_name | VARCHAR(120) | Snapshot | Sí | | Nombre del solicitante (NULL si es anónima) |
| contact_email | VARCHAR(150) | | Sí | | Correo de seguimiento (opcional en anónimas) |
| assignee_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | Sí | | Personal asignado |
| assignee_name | VARCHAR(120) | Snapshot | Sí | | Nombre del asignado |
| subject | VARCHAR(200) | | No | | Asunto |
| description | TEXT | | No | | Descripción detallada |
| campus_uuid | CHAR(36) | Ref. lógica → academic.campuses.uuid | Sí | | Sede relacionada |
| campus_name | VARCHAR(120) | Snapshot | Sí | | Nombre de la sede |
| due_date | DATE | IDX | No | | Fecha límite de respuesta |
| responded_at | TIMESTAMP | | Sí | | Fecha de la primera respuesta oficial |
| closed_at | TIMESTAMP | | Sí | | Fecha de cierre |
| is_active | TINYINT(1) | | No | DEFAULT 1 | Registro activo |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

### 9.4 `pqrs_responses` — Respuestas oficiales

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| pqrs_id | INT UNSIGNED | FK → pqrs.id, IDX | No | ON DELETE CASCADE | PQRS respondida |
| author_uuid | CHAR(36) | Ref. lógica → auth.users.uuid | No | | Autor (personal autorizado) |
| author_name | VARCHAR(120) | Snapshot | No | | Nombre del autor |
| body | TEXT | | No | | Contenido de la respuesta |
| is_final | TINYINT(1) | | No | DEFAULT 1 | Respuesta que cierra la PQRS |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |

### 9.5 `pqrs_attachments` — Adjuntos de la PQRS

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| pqrs_id | INT UNSIGNED | FK → pqrs.id, IDX | No | ON DELETE CASCADE | PQRS |
| uploader_uuid | CHAR(36) | Ref. lógica → auth.users.uuid | Sí | | Quién subió (NULL si es anónima) |
| file_uuid | CHAR(36) | Ref. lógica → storage.files.uuid | No | | Archivo en el almacenamiento |
| original_name | VARCHAR(255) | | No | | Nombre original |
| mime_type | VARCHAR(100) | | No | | Tipo MIME |
| size_bytes | INT UNSIGNED | | No | | Tamaño en bytes |
| uploaded_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de carga |

### 9.6 `pqrs_audit_trail` — Auditoría de transiciones (inmutable)

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| pqrs_id | INT UNSIGNED | FK → pqrs.id, IDX | No | ON DELETE CASCADE | PQRS afectada |
| from_status_id | INT UNSIGNED | FK → pqrs_statuses.id, IDX | Sí | ON DELETE SET NULL | Estado anterior |
| to_status_id | INT UNSIGNED | FK → pqrs_statuses.id, IDX | No | ON DELETE RESTRICT | Estado nuevo |
| actor_uuid | CHAR(36) | Ref. lógica → auth.users.uuid | No | | Actor (personal autorizado) |
| actor_name | VARCHAR(120) | Snapshot | No | | Nombre del actor |
| comment | TEXT | | Sí | | Comentario |
| occurred_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de la transición |

---

## 10. `uajs_storage` — ms-storage

### 10.1 `files` — Metadatos de archivos

| Campo | Tipo | Clave | Nulo | Restricciones / Default | Descripción |
| --- | --- | --- | --- | --- | --- |
| id | INT UNSIGNED | PK | No | AUTO_INCREMENT | Identificador interno |
| uuid | CHAR(36) | UK | No | DEFAULT `UUID()` | Identificador público |
| original_name | VARCHAR(255) | | No | | Nombre original |
| stored_name | VARCHAR(80) | UK | No | | Nombre generado en disco (UUID + extensión) |
| storage_driver | VARCHAR(20) | | No | DEFAULT 'local' | local o s3 |
| storage_path | VARCHAR(500) | | No | | Ruta o key en el backend |
| mime_type | VARCHAR(100) | | No | | Tipo MIME detectado |
| extension | VARCHAR(10) | | No | | Extensión en minúsculas con punto |
| size_bytes | INT UNSIGNED | | No | | Tamaño en bytes |
| checksum_sha256 | CHAR(64) | | No | | SHA-256 del contenido |
| owner_user_uuid | CHAR(36) | Ref. lógica → auth.users.uuid, IDX | No | | Quién subió el archivo |
| owner_type | VARCHAR(30) | IDX (compuesto) | Sí | | Dominio: pqrs, solicitud, evento, perfil |
| owner_reference_uuid | CHAR(36) | IDX (compuesto) | Sí | | UUID del recurso propietario (sin FK) |
| metadata | JSON | | Sí | | Metadatos libres |
| is_active | TINYINT(1) | | No | DEFAULT 1 | 1 = activo, 0 = eliminado |
| created_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | | No | DEFAULT CURRENT_TIMESTAMP ON UPDATE | Fecha de última modificación |

---

## Resumen de claves foráneas por base de datos

Las FK solo existen dentro de la misma base. Entre bases hay referencias lógicas por `uuid`.

| Base de datos | Tablas con FK internas | Referencias lógicas principales |
| --- | --- | --- |
| uajs_catalog | departments, cities | — |
| uajs_academic | faculties, programs, students, teachers | campuses/companies/persons → catalog.cities, catalog.document_types |
| uajs_auth | users, role_permissions, user_roles, user_permissions, refresh_tokens, email_verification_tokens | — |
| uajs_resources | resources, resource_schedules, resource_blackouts, inventory_items | resources.campus_uuid → academic.campuses; blackouts.created_by_uuid → auth.users |
| uajs_bookings | bookings, booking_audit_trail | resource_uuid → resources; requester/approver/actor → auth.users |
| uajs_requests | request_types, requests, request_comments, request_attachments, request_audit_trail | requester/assignee/author/actor → auth.users; file_uuid → storage.files |
| uajs_events | events, event_registrations | organizer/registrant → auth.users; campus → academic.campuses; cover → storage.files |
| uajs_notifications | notifications | recipient/user → auth.users; source_* polimórfica |
| uajs_pqrs | pqrs, pqrs_responses, pqrs_attachments, pqrs_audit_trail | requester/assignee/author/actor → auth.users; campus → academic.campuses |
| uajs_storage | — | owner_user_uuid → auth.users |
