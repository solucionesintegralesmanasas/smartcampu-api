-- ============================================================
-- BASE DE DATOS: uajs_pqrs
-- Microservicio: ms-pqrs
-- Descripción: Peticiones, Quejas, Reclamos y Sugerencias (PQRS)
--              de la comunidad universitaria, con plazos de
--              respuesta por tipo y opción de radicación anónima.
-- Versión: 1.0.0
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_pqrs
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_pqrs;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- pqrs_types
-- Petición | Queja | Reclamo | Sugerencia | Felicitación, cada
-- una con su propio plazo legal/institucional de respuesta
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs_types (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Código del tipo (PETICION|QUEJA|RECLAMO|SUGERENCIA|FELICITACION)',
    name        VARCHAR(80)     NOT NULL COMMENT 'Nombre legible del tipo',
    description TEXT            NULL COMMENT 'Descripción del tipo de PQRS',
    sla_days    SMALLINT UNSIGNED NOT NULL DEFAULT 15 COMMENT 'Plazo de respuesta en días hábiles',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_pqrs_types_uuid (uuid),
    UNIQUE KEY uq_pqrs_types_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de tipos de PQRS y su plazo de respuesta';

-- ------------------------------------------------------------
-- pqrs_statuses
-- Máquina de estados: pending → in_review → responded → closed
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs_statuses (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Código del estado (pending|in_review|responded|closed)',
    name        VARCHAR(50)     NOT NULL COMMENT 'Nombre legible del estado',
    is_terminal TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'No admite más transiciones (estado final)',
    color_hex   CHAR(7)         NULL COMMENT 'Color para la insignia de UI (hexadecimal)',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_pqrs_statuses_uuid (uuid),
    UNIQUE KEY uq_pqrs_statuses_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de estados del ciclo de vida de una PQRS';

-- ------------------------------------------------------------
-- pqrs
-- Una PQRS individual; puede radicarse de forma anónima, en cuyo
-- caso no se almacena la identidad del solicitante.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    ticket_number       VARCHAR(20)     NOT NULL COMMENT 'Número de radicado, ej. PQRS-2025-004321',
    type_id             INT UNSIGNED    NOT NULL COMMENT 'Tipo de PQRS',
    status_id           INT UNSIGNED    NOT NULL COMMENT 'Estado actual de la PQRS',
    -- cross-service (uuid snapshot only) — NULL si is_anonymous = 1
    is_anonymous        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '¿Se radicó de forma anónima?',
    requester_uuid      CHAR(36)        NULL     COMMENT 'Referencia a auth.users.uuid (NULL si es anónima)',
    requester_name      VARCHAR(120)    NULL     COMMENT 'Instantánea desnormalizada del solicitante (NULL si es anónima)',
    contact_email       VARCHAR(150)    NULL     COMMENT 'Correo de contacto para seguimiento (opcional en anónimas)',
    assignee_uuid       CHAR(36)        NULL     COMMENT 'Referencia a auth.users.uuid — personal asignado',
    assignee_name       VARCHAR(120)    NULL COMMENT 'Instantánea desnormalizada del asignado',
    --
    subject             VARCHAR(200)    NOT NULL COMMENT 'Asunto de la PQRS',
    description         TEXT            NOT NULL COMMENT 'Descripción detallada',
    campus_uuid         CHAR(36)        NULL     COMMENT 'Referencia a academic.sedes.uuid (sede relacionada)',
    campus_name         VARCHAR(120)    NULL COMMENT 'Instantánea desnormalizada de la sede',
    due_date            DATE            NOT NULL COMMENT 'Fecha límite de respuesta calculada desde el SLA del tipo al crear',
    responded_at        TIMESTAMP       NULL COMMENT 'Fecha de la primera respuesta oficial',
    closed_at           TIMESTAMP       NULL COMMENT 'Fecha de cierre',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_pqrs_uuid          (uuid),
    UNIQUE KEY uq_pqrs_ticket        (ticket_number),
    KEY        fk_pqrs_type          (type_id),
    KEY        fk_pqrs_status        (status_id),
    KEY        idx_pqrs_requester    (requester_uuid),
    KEY        idx_pqrs_assignee     (assignee_uuid),
    KEY        idx_pqrs_due          (due_date),
    CONSTRAINT fk_pqrs_type
        FOREIGN KEY (type_id) REFERENCES pqrs_types (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pqrs_status
        FOREIGN KEY (status_id) REFERENCES pqrs_statuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Peticiones, quejas, reclamos y sugerencias radicadas por la comunidad';

-- ------------------------------------------------------------
-- pqrs_responses
-- Respuestas oficiales del personal encargado a una PQRS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs_responses (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    pqrs_id         INT UNSIGNED    NOT NULL COMMENT 'PQRS a la que pertenece la respuesta',
    author_uuid     CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (autor, siempre personal autorizado)',
    author_name     VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del autor',
    body            TEXT            NOT NULL COMMENT 'Contenido de la respuesta oficial',
    is_final        TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '¿Es la respuesta que cierra la PQRS?',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_pqrs_responses_uuid (uuid),
    KEY        fk_pr_pqrs             (pqrs_id),
    CONSTRAINT fk_pr_pqrs
        FOREIGN KEY (pqrs_id) REFERENCES pqrs (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Respuestas oficiales del personal a una PQRS';

-- ------------------------------------------------------------
-- pqrs_attachments
-- Referencias de archivos (los archivos reales viven en ms-storage)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs_attachments (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    pqrs_id         INT UNSIGNED    NOT NULL COMMENT 'PQRS a la que pertenece el adjunto',
    uploader_uuid   CHAR(36)        NULL     COMMENT 'Referencia a auth.users.uuid (NULL si el radicado fue anónimo)',
    file_uuid       CHAR(36)        NOT NULL COMMENT 'Referencia al archivo en ms-storage',
    original_name   VARCHAR(255)    NOT NULL COMMENT 'Nombre original del archivo',
    mime_type       VARCHAR(100)    NOT NULL COMMENT 'Tipo MIME del archivo',
    size_bytes      INT UNSIGNED    NOT NULL COMMENT 'Tamaño del archivo en bytes',
    uploaded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de carga',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_pqrs_attachments_uuid (uuid),
    KEY        fk_pa_pqrs               (pqrs_id),
    CONSTRAINT fk_pa_pqrs
        FOREIGN KEY (pqrs_id) REFERENCES pqrs (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Archivos adjuntos de una PQRS';

-- ------------------------------------------------------------
-- pqrs_audit_trail
-- Registro inmutable de transiciones de estado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs_audit_trail (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    pqrs_id             INT UNSIGNED    NOT NULL COMMENT 'PQRS afectada',
    from_status_id      INT UNSIGNED    NULL COMMENT 'Estado anterior',
    to_status_id        INT UNSIGNED    NOT NULL COMMENT 'Estado nuevo',
    actor_uuid          CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (actor, siempre personal autorizado)',
    actor_name          VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del actor',
    comment             TEXT            NULL COMMENT 'Comentario de la transición',
    occurred_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la transición',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_pat_uuid          (uuid),
    KEY        fk_pat_pqrs          (pqrs_id),
    KEY        fk_pat_from_status   (from_status_id),
    KEY        fk_pat_to_status     (to_status_id),
    CONSTRAINT fk_pat_pqrs
        FOREIGN KEY (pqrs_id) REFERENCES pqrs (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pat_from_status
        FOREIGN KEY (from_status_id) REFERENCES pqrs_statuses (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_pat_to_status
        FOREIGN KEY (to_status_id) REFERENCES pqrs_statuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Rastro de auditoría inmutable de transiciones de estado de PQRS';

SET FOREIGN_KEY_CHECKS = 1;
