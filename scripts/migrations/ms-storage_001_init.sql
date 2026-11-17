-- ============================================================
-- BASE DE DATOS: uajs_storage
-- Microservicio: ms-storage
-- Descripción: Metadata de archivos subidos por los usuarios
--              (PQRS, solicitudes, eventos, etc.). El contenido
--              binario vive en disco (o en el backend que defina
--              STORAGE_DRIVER); esta base solo guarda metadata.
--              Las referencias a otros servicios usan uuid (sin
--              FK a bases de datos externas).
-- Versión: 1.0.0
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_storage
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_storage;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- files  (archivos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    original_name       VARCHAR(255)    NOT NULL COMMENT 'Nombre original del archivo subido por el usuario',
    stored_name         VARCHAR(80)     NOT NULL COMMENT 'Nombre generado (UUID + extensión) con el que se guarda en disco',
    storage_driver      VARCHAR(20)     NOT NULL DEFAULT 'local' COMMENT 'Backend de almacenamiento: local|s3',
    storage_path        VARCHAR(500)    NOT NULL COMMENT 'Ruta o key dentro del backend de almacenamiento',
    mime_type           VARCHAR(100)    NOT NULL COMMENT 'Tipo MIME detectado',
    extension           VARCHAR(10)     NOT NULL COMMENT 'Extensión en minúsculas, con punto (.pdf, .jpg, ...)',
    size_bytes          INT UNSIGNED    NOT NULL COMMENT 'Tamaño en bytes',
    checksum_sha256     CHAR(64)        NOT NULL COMMENT 'SHA-256 del contenido, para verificar integridad',
    owner_user_uuid     CHAR(36)        NOT NULL COMMENT 'Referencia auth.users.uuid — quién subió el archivo',
    owner_type          VARCHAR(30)     NULL COMMENT 'Dominio propietario del adjunto: pqrs|solicitud|evento|perfil (opcional)',
    owner_reference_uuid CHAR(36)       NULL COMMENT 'uuid del recurso al que pertenece el adjunto (opcional, cross-service)',
    metadata            JSON            NULL COMMENT 'Metadata adicional libre en JSON',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o eliminado (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_files_uuid        (uuid),
    UNIQUE KEY uq_files_stored_name (stored_name),
    KEY        idx_files_owner_user (owner_user_uuid),
    KEY        idx_files_owner_ref  (owner_type, owner_reference_uuid)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Metadata de archivos subidos (el contenido vive en el storage driver configurado)';

SET FOREIGN_KEY_CHECKS = 1;
