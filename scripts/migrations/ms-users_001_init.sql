-- ============================================================
-- BASE DE DATOS: uajs_users
-- Microservicio: ms-users (user-service)
-- Descripción: Perfil y preferencias de los usuarios. La identidad
--              (cuenta, roles, contraseñas) vive en uajs_auth y NO se
--              duplica aquí; las tablas se indexan por user_id (sub del JWT).
-- Versión: 1.0.0
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_users
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_users;

SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- user_profiles
-- Datos personales y de contacto del usuario autenticado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    user_id             INT UNSIGNED    NOT NULL COMMENT 'Referencia a uajs_auth.users.id (sub del JWT); sin FK entre bases',
    first_name          VARCHAR(80)     NOT NULL COMMENT 'Nombres del usuario',
    last_name           VARCHAR(80)     NOT NULL COMMENT 'Apellidos del usuario',
    document_number     VARCHAR(20)     NULL COMMENT 'Número de documento de identidad',
    phone               VARCHAR(20)     NULL COMMENT 'Teléfono de contacto',
    avatar_file_uuid    CHAR(36)        NULL COMMENT 'Referencia al avatar en uajs_storage (uuid del archivo)',
    birth_date          DATE            NULL COMMENT 'Fecha de nacimiento',
    city_code           VARCHAR(10)     NULL COMMENT 'Código DANE del municipio de residencia',
    timezone            VARCHAR(50)     NOT NULL DEFAULT 'America/Bogota' COMMENT 'Zona horaria IANA del usuario',
    locale              VARCHAR(10)     NOT NULL DEFAULT 'es-CO' COMMENT 'Idioma y región preferidos (BCP 47)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    deleted_at          TIMESTAMP       NULL COMMENT 'Eliminación suave (soft delete)',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_profiles_uuid     (uuid),
    UNIQUE KEY uq_user_profiles_user_id  (user_id),
    KEY        idx_user_profiles_document (document_number),
    KEY        idx_user_profiles_name     (last_name, first_name)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Perfil personal y de contacto de los usuarios';

-- ------------------------------------------------------------
-- user_preferences
-- Preferencias de notificación y horario de silencio del usuario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    user_id             INT UNSIGNED    NOT NULL COMMENT 'Referencia a uajs_auth.users.id (sub del JWT); sin FK entre bases',
    notify_email        TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Recibir notificaciones por correo (1) o no (0)',
    notify_push         TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Recibir notificaciones push (1) o no (0)',
    quiet_hours_start   TIME            NULL COMMENT 'Inicio del horario de silencio (hora local del usuario)',
    quiet_hours_end     TIME            NULL COMMENT 'Fin del horario de silencio (hora local del usuario)',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_user_preferences_uuid     (uuid),
    UNIQUE KEY uq_user_preferences_user_id  (user_id),
    CONSTRAINT chk_user_preferences_quiet
        CHECK ((quiet_hours_start IS NULL) = (quiet_hours_end IS NULL)),
    CONSTRAINT chk_user_preferences_flags
        CHECK (notify_email IN (0, 1) AND notify_push IN (0, 1))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Preferencias de notificación y horario de silencio de los usuarios';
