-- ============================================================
-- BASE DE DATOS: uajs_pqrs
-- Microservicio: ms-pqrs / pqrs-service
-- Descripción: Peticiones, quejas, reclamos, sugerencias y
--              felicitaciones (PQRS) con plazo legal de respuesta,
--              respuestas de funcionarios y auditoría de estados.
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
-- Tipos de PQRS y plazo de respuesta en días hábiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs_types (
    id                    INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                  CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code                  VARCHAR(20)     NOT NULL COMMENT 'Código del tipo (PETICION, QUEJA, RECLAMO, SUGERENCIA, FELICITACION)',
    name                  VARCHAR(80)     NOT NULL COMMENT 'Nombre legible del tipo',
    response_days_business SMALLINT UNSIGNED NOT NULL DEFAULT 15 COMMENT 'Plazo de respuesta en días hábiles',
    is_active             TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_pqrs_types_uuid (uuid),
    UNIQUE KEY uq_pqrs_types_code (code),
    CONSTRAINT chk_pqrs_types_plazo CHECK (response_days_business > 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Tipos de PQRS con su plazo legal de respuesta';

-- ------------------------------------------------------------
-- pqrs_statuses
-- Máquina de estados: radicada → en_tramite → respondida → cerrada
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs_statuses (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Código del estado (radicada|en_tramite|respondida|cerrada)',
    name        VARCHAR(50)     NOT NULL COMMENT 'Nombre legible del estado',
    is_terminal TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'No admite más transiciones (estado final)',
    color_hex   CHAR(7)         NULL     COMMENT 'Color para la insignia de UI (hexadecimal)',
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
-- Una PQRS radicada. Puede ser anónima (sin solicitante identificado).
-- Referencias externas: solo uuid + instantánea de nombre.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    ticket_number       VARCHAR(20)     NOT NULL COMMENT 'Número de radicado, ej. PQRS-2026-000001',
    type_id             INT UNSIGNED    NOT NULL COMMENT 'Tipo de PQRS',
    status_id           INT UNSIGNED    NOT NULL COMMENT 'Estado actual',
    -- cross-service (uuid snapshot only)
    is_anonymous        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Radicada de forma anónima (1) o identificada (0)',
    requester_uuid      CHAR(36)        NULL     COMMENT 'Referencia a auth.users.uuid (peticionario)',
    requester_name      VARCHAR(120)    NULL     COMMENT 'Instantánea desnormalizada del peticionario',
    requester_email     VARCHAR(150)    NULL     COMMENT 'Correo de contacto para la respuesta',
    assignee_uuid       CHAR(36)        NULL     COMMENT 'Referencia a auth.users.uuid (funcionario asignado)',
    assignee_name       VARCHAR(120)    NULL     COMMENT 'Instantánea desnormalizada del asignado',
    --
    subject             VARCHAR(200)    NOT NULL COMMENT 'Asunto de la PQRS',
    description         TEXT            NOT NULL COMMENT 'Descripción detallada',
    filed_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de radicación',
    response_due_date   DATE            NOT NULL COMMENT 'Fecha límite legal de respuesta (calculada en días hábiles)',
    responded_at        TIMESTAMP       NULL     COMMENT 'Fecha de la primera respuesta',
    closed_at           TIMESTAMP       NULL     COMMENT 'Fecha de cierre',
    satisfaction_score  TINYINT UNSIGNED NULL    COMMENT 'Calificación del peticionario (1 a 5)',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    deleted_at          TIMESTAMP       NULL     COMMENT 'Eliminación suave (soft delete)',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_pqrs_uuid             (uuid),
    UNIQUE KEY uq_pqrs_ticket           (ticket_number),
    KEY        fk_pqrs_type             (type_id),
    KEY        fk_pqrs_status           (status_id),
    KEY        idx_pqrs_requester       (requester_uuid),
    KEY        idx_pqrs_assignee        (assignee_uuid),
    KEY        idx_pqrs_due             (response_due_date),
    CONSTRAINT fk_pqrs_type
        FOREIGN KEY (type_id) REFERENCES pqrs_types (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pqrs_status
        FOREIGN KEY (status_id) REFERENCES pqrs_statuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_pqrs_satisfaction CHECK (satisfaction_score IS NULL OR satisfaction_score BETWEEN 1 AND 5),
    CONSTRAINT chk_pqrs_identidad CHECK (is_anonymous = 1 OR requester_uuid IS NOT NULL)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Peticiones, quejas, reclamos, sugerencias y felicitaciones radicadas';

-- ------------------------------------------------------------
-- pqrs_responses
-- Respuestas formales emitidas por funcionarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs_responses (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    pqrs_id         INT UNSIGNED    NOT NULL COMMENT 'PQRS a la que responde',
    responder_uuid  CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (funcionario que responde)',
    responder_name  VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del funcionario',
    body            TEXT            NOT NULL COMMENT 'Contenido de la respuesta',
    is_final        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Respuesta definitiva (1) o parcial (0)',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la respuesta',
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
  COMMENT = 'Respuestas emitidas por funcionarios a una PQRS';

-- ------------------------------------------------------------
-- pqrs_audit_trail
-- Registro inmutable de transiciones de estado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pqrs_audit_trail (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    pqrs_id         INT UNSIGNED    NOT NULL COMMENT 'PQRS afectada',
    from_status_id  INT UNSIGNED    NULL     COMMENT 'Estado anterior',
    to_status_id    INT UNSIGNED    NOT NULL COMMENT 'Estado nuevo',
    actor_uuid      CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (actor)',
    actor_name      VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del actor',
    comment         TEXT            NULL     COMMENT 'Comentario de la transición',
    occurred_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la transición',
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
