-- ============================================================
-- BASE DE DATOS: uajs_auth
-- Microservicio: ms-auth
-- Descripción: Autenticación, autorización, RBAC (roles,
--              permisos, tokens). Única fuente de verdad para la
--              identidad. Los JWTs solo se emiten aquí.
-- Versión: 1.0.0
-- Autor: Darwin Montes
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_auth
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_auth;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- persons
-- Instantánea desnormalizada de datos personales (proveniente de
-- ms-academic o ms-catalog). Se mantiene mínima para evitar acoplamiento.
-- Los datos completos de la persona viven en ms-academic.persons.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS persons (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    -- catalog references (cross-service, stored as plain values)
    document_type_code  VARCHAR(10)     NOT NULL COMMENT 'Refleja catalog.document_types.code',
    document_number     VARCHAR(30)     NOT NULL COMMENT 'Número de documento de identidad',
    check_digit         CHAR(1)         NULL COMMENT 'Dígito de verificación',
    first_name          VARCHAR(50)     NOT NULL COMMENT 'Primer nombre',
    middle_name         VARCHAR(50)     NULL COMMENT 'Segundo nombre',
    last_name           VARCHAR(50)     NOT NULL COMMENT 'Primer apellido',
    second_last_name    VARCHAR(50)     NULL COMMENT 'Segundo apellido',
    email               VARCHAR(150)    NULL COMMENT 'Correo electrónico',
    phone               VARCHAR(20)     NULL COMMENT 'Teléfono de contacto',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_persons_uuid             (uuid),
    UNIQUE KEY uq_persons_document         (document_type_code, document_number)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Instantánea mínima de la persona usada para el vínculo de autenticación';

-- ------------------------------------------------------------
-- users
-- Entidad principal de autenticación
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    person_id           INT UNSIGNED    NULL COMMENT 'Persona natural asociada',
    email               VARCHAR(150)    NOT NULL COMMENT 'Correo electrónico de acceso',
    password_hash       VARCHAR(255)    NOT NULL COMMENT 'Hash bcrypt $2b$12$',
    email_verified_at   TIMESTAMP       NULL COMMENT 'Fecha de verificación del correo',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Cuenta activa (1) o inactiva (0)',
    last_login_at       TIMESTAMP       NULL COMMENT 'Fecha del último inicio de sesión',
    last_login_ip       VARCHAR(45)     NULL COMMENT 'IPv4 o IPv6',
    failed_attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Intentos fallidos consecutivos',
    locked_until        TIMESTAMP       NULL COMMENT 'Bloqueo temporal tras N intentos fallidos',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    deleted_at          TIMESTAMP       NULL     COMMENT 'Eliminación suave (soft delete)',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_uuid      (uuid),
    UNIQUE KEY uq_users_email     (email),
    KEY        fk_users_person    (person_id),
    CONSTRAINT fk_users_person
        FOREIGN KEY (person_id) REFERENCES persons (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Cuentas de usuario principales';

-- ------------------------------------------------------------
-- roles
-- Grupos de permisos con nombre (capa 1 del RBAC)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    name        VARCHAR(50)     NOT NULL COMMENT 'Nombre del rol, ej. ADMIN, STUDENT, TEACHER',
    guard_name  VARCHAR(50)     NOT NULL DEFAULT 'api' COMMENT 'Guard de autenticación asociado',
    description VARCHAR(255)    NULL COMMENT 'Descripción del rol',
    is_system   TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Los roles de sistema no pueden eliminarse',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_uuid       (uuid),
    UNIQUE KEY uq_roles_name_guard (name, guard_name)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de roles RBAC';

-- ------------------------------------------------------------
-- permissions
-- Descriptores de acción de grano fino (capa 2 del RBAC)
-- Convención: <modulo>.<recurso>.<accion>
-- ej.: academic.students.create, bookings.rooms.approve
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    name        VARCHAR(100)    NOT NULL COMMENT 'Nombre del permiso, ej. academic.students.create',
    guard_name  VARCHAR(50)     NOT NULL DEFAULT 'api' COMMENT 'Guard de autenticación asociado',
    module      VARCHAR(50)     NOT NULL COMMENT 'Módulo del microservicio propietario',
    resource    VARCHAR(50)     NOT NULL COMMENT 'Entidad protegida',
    action      VARCHAR(30)     NOT NULL COMMENT 'Acción: create|read|update|delete|approve|export',
    description VARCHAR(255)    NULL COMMENT 'Descripción del permiso',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_permissions_uuid       (uuid),
    UNIQUE KEY uq_permissions_name_guard (name, guard_name),
    KEY        idx_permissions_module    (module)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Descriptores de permiso de grano fino';

-- ------------------------------------------------------------
-- role_permissions
-- Relación muchos a muchos: roles <-> permisos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id         INT UNSIGNED    NOT NULL COMMENT 'Rol al que se le asigna el permiso',
    permission_id   INT UNSIGNED    NOT NULL COMMENT 'Permiso asignado al rol',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    --
    PRIMARY KEY (role_id, permission_id),
    KEY        fk_rp_role        (role_id),
    KEY        fk_rp_permission  (permission_id),
    CONSTRAINT fk_rp_role
        FOREIGN KEY (role_id) REFERENCES roles (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rp_permission
        FOREIGN KEY (permission_id) REFERENCES permissions (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Asignaciones Rol ↔ Permiso';

-- ------------------------------------------------------------
-- user_roles
-- Relación muchos a muchos: usuarios <-> roles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
    user_id     INT UNSIGNED    NOT NULL COMMENT 'Usuario al que se le asigna el rol',
    role_id     INT UNSIGNED    NOT NULL COMMENT 'Rol asignado al usuario',
    assigned_by INT UNSIGNED    NULL COMMENT 'user_id de quien asignó el rol',
    assigned_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de asignación',
    expires_at  TIMESTAMP       NULL     COMMENT 'Rol con vigencia opcional (limitado en el tiempo)',
    --
    PRIMARY KEY (user_id, role_id),
    KEY        fk_ur_user   (user_id),
    KEY        fk_ur_role   (role_id),
    CONSTRAINT fk_ur_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_ur_role
        FOREIGN KEY (role_id) REFERENCES roles (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Asignaciones Usuario ↔ Rol';

-- ------------------------------------------------------------
-- user_permissions
-- Concesiones directas de permisos (anulan / complementan roles)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_permissions (
    user_id         INT UNSIGNED    NOT NULL COMMENT 'Usuario al que se aplica el permiso',
    permission_id   INT UNSIGNED    NOT NULL COMMENT 'Permiso concedido',
    granted         TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '1=conceder, 0=denegar (la denegación explícita prevalece)',
    assigned_by     INT UNSIGNED    NULL COMMENT 'user_id de quien asignó',
    assigned_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de asignación',
    expires_at      TIMESTAMP       NULL COMMENT 'Vencimiento opcional de la concesión',
    --
    PRIMARY KEY (user_id, permission_id),
    KEY        fk_up_user        (user_id),
    KEY        fk_up_permission  (permission_id),
    CONSTRAINT fk_up_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_up_permission
        FOREIGN KEY (permission_id) REFERENCES permissions (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Concesiones directas de permiso a usuario (omiten roles)';

-- ------------------------------------------------------------
-- refresh_tokens
-- Tokens JWT de refresco persistentes (estrategia de rotación)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    user_id         INT UNSIGNED    NOT NULL COMMENT 'Usuario propietario del token',
    token_hash      VARCHAR(255)    NOT NULL COMMENT 'SHA-256 del token crudo — nunca almacenar el crudo',
    family_id       CHAR(36)        NOT NULL COMMENT 'Familia de tokens para detección de robo por rotación',
    device_info     VARCHAR(255)    NULL COMMENT 'Instantánea del User-Agent',
    ip_address      VARCHAR(45)     NULL COMMENT 'Dirección IP de origen',
    issued_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de emisión',
    expires_at      TIMESTAMP       NOT NULL COMMENT 'Fecha de expiración',
    revoked_at      TIMESTAMP       NULL COMMENT 'Fecha de revocación',
    revoke_reason   VARCHAR(50)     NULL COMMENT 'Motivo: logout|rotation|theft|admin',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_refresh_tokens_uuid       (uuid),
    UNIQUE KEY uq_refresh_tokens_hash       (token_hash),
    KEY        fk_rt_user                   (user_id),
    KEY        idx_refresh_tokens_family    (family_id),
    KEY        idx_refresh_tokens_expires   (expires_at),
    CONSTRAINT fk_rt_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Tokens de refresco JWT con rotación por familia';

-- ------------------------------------------------------------
-- password_reset_tokens
-- Tokens de un solo uso para recuperación de contraseña
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    email       VARCHAR(150)    NOT NULL COMMENT 'Correo del usuario solicitante',
    token_hash  VARCHAR(255)    NOT NULL COMMENT 'SHA-256 del OTP crudo',
    expires_at  TIMESTAMP       NOT NULL COMMENT 'Fecha de expiración',
    used_at     TIMESTAMP       NULL COMMENT 'Fecha de uso del token',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    --
    PRIMARY KEY (id),
    KEY        idx_prt_email   (email),
    KEY        idx_prt_expires (expires_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Tokens de restablecimiento de contraseña de un solo uso';

-- ------------------------------------------------------------
-- email_verification_tokens
-- Verificación de propiedad de la dirección de correo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    user_id     INT UNSIGNED    NOT NULL COMMENT 'Usuario propietario del token',
    token_hash  VARCHAR(255)    NOT NULL COMMENT 'Hash del token de verificación',
    expires_at  TIMESTAMP       NOT NULL COMMENT 'Fecha de expiración',
    verified_at TIMESTAMP       NULL COMMENT 'Fecha de verificación efectiva',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    --
    PRIMARY KEY (id),
    KEY        fk_evt_user     (user_id),
    KEY        idx_evt_expires (expires_at),
    CONSTRAINT fk_evt_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Tokens de verificación de correo electrónico';

-- ------------------------------------------------------------
-- audit_logs
-- Rastro de auditoría de seguridad inmutable (solo eventos de auth)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    user_id     INT UNSIGNED    NULL     COMMENT 'NULL para intentos no autenticados',
    event       VARCHAR(60)     NOT NULL COMMENT 'login.success|login.failed|logout|password.reset|token.rotated|role.assigned',
    ip_address  VARCHAR(45)     NULL COMMENT 'Dirección IP de origen',
    user_agent  TEXT            NULL COMMENT 'User-Agent del cliente',
    metadata    JSON            NULL     COMMENT 'Carga útil específica del evento',
    occurred_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora del evento',
    --
    PRIMARY KEY (id),
    KEY        idx_al_user       (user_id),
    KEY        idx_al_event      (event),
    KEY        idx_al_occurred   (occurred_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Rastro de auditoría de seguridad inmutable (auth)';

SET FOREIGN_KEY_CHECKS = 1;
