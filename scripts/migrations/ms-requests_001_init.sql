-- ============================================================
-- BASE DE DATOS: uajs_requests
-- Microservicio: ms-requests
-- Descripción: Gestión de solicitudes estilo mesa de servicio —
--              certificados, constancias, cambios de matrícula,
--              apelaciones académicas y peticiones generales.
-- Versión: 1.0.0
-- Autor: Darwin Montes
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_requests
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_requests;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- request_categories
-- Agrupación de alto nivel para la navegación de la UI
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_categories (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Código abreviado de la categoría',
    name        VARCHAR(80)     NOT NULL COMMENT 'Nombre de la categoría',
    icon        VARCHAR(60)     NULL COMMENT 'Identificador del icono (lucide / font-awesome)',
    sort_order  SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Orden de visualización',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_request_categories_uuid (uuid),
    UNIQUE KEY uq_request_categories_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Grupos de categorías de solicitudes (certificados, apelaciones, etc.)';

-- ------------------------------------------------------------
-- request_types
-- Plantillas de solicitud específicas con SLA y reglas de aprobación
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_types (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    category_id         INT UNSIGNED    NOT NULL COMMENT 'Categoría a la que pertenece',
    code                VARCHAR(20)     NOT NULL COMMENT 'Código abreviado del tipo de solicitud',
    name                VARCHAR(80)     NOT NULL COMMENT 'Nombre del tipo de solicitud',
    description         TEXT            NULL COMMENT 'Descripción del tipo de solicitud',
    requires_approval   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '¿Requiere aprobación?',
    sla_days            SMALLINT UNSIGNED NULL    COMMENT 'Acuerdo de nivel de servicio en días hábiles (SLA)',
    cost                DECIMAL(12,2)   NULL      COMMENT 'Costo en COP (NULL = gratuito)',
    form_schema         JSON            NULL      COMMENT 'Definición de los campos dinámicos del formulario',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_request_types_uuid (uuid),
    UNIQUE KEY uq_request_types_code (code),
    KEY        fk_rt_category        (category_id),
    CONSTRAINT fk_rt_category
        FOREIGN KEY (category_id) REFERENCES request_categories (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Tipos de solicitud específicos con SLA y esquema de formulario';

-- ------------------------------------------------------------
-- request_statuses
-- Máquina de estados: pending → in_review → approved|rejected → closed
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_statuses (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Código del estado (pending|in_review|approved|rejected|closed)',
    name        VARCHAR(50)     NOT NULL COMMENT 'Nombre legible del estado',
    is_terminal TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'No admite más transiciones (estado final)',
    color_hex   CHAR(7)         NULL COMMENT 'Color para la insignia de UI (hexadecimal)',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_request_statuses_uuid (uuid),
    UNIQUE KEY uq_request_statuses_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de estados del ciclo de vida de la solicitud';

-- ------------------------------------------------------------
-- requests
-- Una solicitud individual presentada por un usuario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    ticket_number       VARCHAR(20)     NOT NULL COMMENT 'Número de ticket, ej. REQ-2025-004321',
    request_type_id     INT UNSIGNED    NOT NULL COMMENT 'Tipo de solicitud',
    status_id           INT UNSIGNED    NOT NULL COMMENT 'Estado actual de la solicitud',
    -- cross-service (uuid snapshot only)
    requester_uuid      CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (solicitante)',
    requester_name      VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del solicitante',
    assignee_uuid       CHAR(36)        NULL     COMMENT 'Referencia a auth.users.uuid — personal asignado',
    assignee_name       VARCHAR(120)    NULL COMMENT 'Instantánea desnormalizada del asignado',
    --
    title               VARCHAR(200)    NOT NULL COMMENT 'Título de la solicitud',
    description         TEXT            NOT NULL COMMENT 'Descripción de la solicitud',
    form_data           JSON            NULL     COMMENT 'Carga útil enviada del formulario dinámico',
    resolution_notes    TEXT            NULL COMMENT 'Notas de resolución',
    due_date            DATE            NULL     COMMENT 'Fecha límite calculada desde el SLA al crear',
    resolved_at         TIMESTAMP       NULL COMMENT 'Fecha de resolución',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_requests_uuid          (uuid),
    UNIQUE KEY uq_requests_ticket        (ticket_number),
    KEY        fk_req_type               (request_type_id),
    KEY        fk_req_status             (status_id),
    KEY        idx_requests_requester    (requester_uuid),
    KEY        idx_requests_assignee     (assignee_uuid),
    KEY        idx_requests_due          (due_date),
    CONSTRAINT fk_req_type
        FOREIGN KEY (request_type_id) REFERENCES request_types (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_req_status
        FOREIGN KEY (status_id) REFERENCES request_statuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Solicitudes/tickets presentados por los usuarios';

-- ------------------------------------------------------------
-- request_comments
-- Comentarios en hilo entre el solicitante y el personal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_comments (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    request_id      INT UNSIGNED    NOT NULL COMMENT 'Solicitud a la que pertenece el comentario',
    author_uuid     CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (autor)',
    author_name     VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del autor',
    body            TEXT            NOT NULL COMMENT 'Contenido del comentario',
    is_internal     TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Nota solo para el personal, no visible para el solicitante',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    deleted_at      TIMESTAMP       NULL COMMENT 'Eliminación suave (soft delete)',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_request_comments_uuid  (uuid),
    KEY        fk_rc_request             (request_id),
    CONSTRAINT fk_rc_request
        FOREIGN KEY (request_id) REFERENCES requests (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Comentarios en hilo de solicitudes';

-- ------------------------------------------------------------
-- request_attachments
-- Referencias de archivos (los archivos reales se almacenan en ms-files / S3)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_attachments (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    request_id      INT UNSIGNED    NOT NULL COMMENT 'Solicitud a la que pertenece el adjunto',
    uploader_uuid   CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (quien subió)',
    file_uuid       CHAR(36)        NOT NULL COMMENT 'Referencia al archivo en ms-files',
    original_name   VARCHAR(255)    NOT NULL COMMENT 'Nombre original del archivo',
    mime_type       VARCHAR(100)    NOT NULL COMMENT 'Tipo MIME del archivo',
    size_bytes      INT UNSIGNED    NOT NULL COMMENT 'Tamaño del archivo en bytes',
    uploaded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de carga',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_request_attachments_uuid (uuid),
    KEY        fk_ra_request               (request_id),
    CONSTRAINT fk_ra_request
        FOREIGN KEY (request_id) REFERENCES requests (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Archivos adjuntos de solicitudes';

-- ------------------------------------------------------------
-- request_audit_trail
-- Registro inmutable de transiciones de estado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_audit_trail (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    request_id          INT UNSIGNED    NOT NULL COMMENT 'Solicitud afectada',
    from_status_id      INT UNSIGNED    NULL COMMENT 'Estado anterior',
    to_status_id        INT UNSIGNED    NOT NULL COMMENT 'Estado nuevo',
    actor_uuid          CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (actor)',
    actor_name          VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del actor',
    comment             TEXT            NULL COMMENT 'Comentario de la transición',
    occurred_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la transición',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_rat_uuid          (uuid),
    KEY        fk_rat_request       (request_id),
    KEY        fk_rat_from_status   (from_status_id),
    KEY        fk_rat_to_status     (to_status_id),
    CONSTRAINT fk_rat_request
        FOREIGN KEY (request_id) REFERENCES requests (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rat_from_status
        FOREIGN KEY (from_status_id) REFERENCES request_statuses (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_rat_to_status
        FOREIGN KEY (to_status_id) REFERENCES request_statuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Rastro de auditoría inmutable de transiciones de estado de solicitudes';

SET FOREIGN_KEY_CHECKS = 1;
