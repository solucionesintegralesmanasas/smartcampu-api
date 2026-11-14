-- ============================================================
-- BASE DE DATOS: uajs_storage
-- Microservicio: storage-service
-- Descripción: Metadatos de archivos cargados por los usuarios.
--              Los binarios se guardan en el sistema de archivos
--              (UPLOAD_DIR) y su metadata se indexa en Elasticsearch.
-- Versión: 1.0.0
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_storage
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_storage;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- archivos
-- Un registro por archivo cargado. Soft delete con deleted_at.
-- Nombres de columnas alineados con el mapping de Elasticsearch
-- (packages/shared-elasticsearch/src/mappings/storage.mapping.js).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS archivos (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    nombre_original     VARCHAR(255)    NOT NULL COMMENT 'Nombre original del archivo cargado',
    nombre_sistema      VARCHAR(255)    NOT NULL COMMENT 'Nombre generado en disco (uuid + extensión)',
    ruta_acceso         VARCHAR(500)    NOT NULL COMMENT 'Ruta física de almacenamiento',
    mime_type           VARCHAR(100)    NOT NULL COMMENT 'Tipo MIME validado',
    peso_bytes          BIGINT UNSIGNED NOT NULL COMMENT 'Tamaño del archivo en bytes',
    extension           VARCHAR(10)     NOT NULL COMMENT 'Extensión en minúsculas, ej. .pdf',
    entidad_asociada    VARCHAR(50)     NULL     COMMENT 'Tipo de entidad a la que pertenece (request, booking, etc.)',
    uuid_asociado       CHAR(36)        NULL     COMMENT 'UUID de la entidad asociada en su servicio dueño',
    subido_por          INT UNSIGNED    NULL     COMMENT 'Identificador del usuario que cargó el archivo',
    subido_por_nombre   VARCHAR(120)    NULL     COMMENT 'Instantánea desnormalizada del usuario',
    carpeta             VARCHAR(100)    NOT NULL DEFAULT 'general' COMMENT 'Carpeta lógica de organización',
    publico             TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Acceso público (1) o restringido (0)',
    activo              TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    createdAt           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updatedAt           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    deleted_at          TIMESTAMP       NULL     COMMENT 'Eliminación suave (soft delete)',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_archivos_uuid            (uuid),
    UNIQUE KEY uq_archivos_nombre_sistema  (nombre_sistema),
    KEY        idx_archivos_entidad        (entidad_asociada, uuid_asociado),
    KEY        idx_archivos_subido_por     (subido_por),
    KEY        idx_archivos_carpeta        (carpeta),
    CONSTRAINT chk_archivos_peso CHECK (peso_bytes > 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Metadatos de archivos cargados en el campus';

SET FOREIGN_KEY_CHECKS = 1;
