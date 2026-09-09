-- ============================================================
-- BASE DE DATOS: uajs_bookings
-- Microservicio: ms-bookings
-- Descripción: Ciclo de vida de las reservas de recursos — creación,
--              flujo de aprobación, detección de conflictos y
--              cancelación. Lee la disponibilidad de recursos de
--              ms-resources vía API/evento.
-- Versión: 1.0.0
-- Autor: Darwin Montes
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_bookings
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_bookings;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- booking_types
-- Categorías de propósito de una reserva
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_types (
    id                      INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                    CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code                    VARCHAR(20)     NOT NULL COMMENT 'Código abreviado del tipo',
    name                    VARCHAR(50)     NOT NULL COMMENT 'Nombre del tipo de reserva',
    description             TEXT            NULL COMMENT 'Descripción detallada',
    requires_approval       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '¿Requiere aprobación?',
    max_duration_minutes    INT UNSIGNED    NULL     COMMENT 'Duración máxima en minutos (NULL = ilimitada)',
    advance_days_limit      SMALLINT UNSIGNED NULL   COMMENT 'Días máximos de antelación para reservar',
    is_active               TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_booking_types_uuid (uuid),
    UNIQUE KEY uq_booking_types_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de propósitos/tipos de reserva';

-- ------------------------------------------------------------
-- booking_statuses
-- Valores de la máquina de estados para el ciclo de vida de la reserva
-- pending → approved / rejected
-- approved → confirmed → completed / cancelled
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_statuses (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Estado: pending|approved|rejected|confirmed|cancelled|completed|no_show',
    name        VARCHAR(50)     NOT NULL COMMENT 'Nombre legible del estado',
    is_terminal TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'No admite más transiciones (estado final)',
    color_hex   CHAR(7)         NULL COMMENT 'Color para la insignia de UI (hexadecimal)',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_booking_statuses_uuid (uuid),
    UNIQUE KEY uq_booking_statuses_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Estados del ciclo de vida de la reserva';

-- ------------------------------------------------------------
-- bookings
-- El registro principal de la reserva
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    reference_number    VARCHAR(20)     NOT NULL COMMENT 'Legible para humanos, ej. BK-2025-001234',
    booking_type_id     INT UNSIGNED    NOT NULL COMMENT 'Tipo de reserva',
    status_id           INT UNSIGNED    NOT NULL COMMENT 'Estado actual de la reserva',
    -- cross-service references (uuid snapshots — no FK to ext. DBs)
    resource_uuid       CHAR(36)        NOT NULL COMMENT 'Referencia a resources.resources.uuid',
    resource_name       VARCHAR(100)    NOT NULL COMMENT 'Instantánea desnormalizada del nombre del recurso',
    requester_uuid      CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid',
    requester_name      VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del solicitante',
    approver_uuid       CHAR(36)        NULL     COMMENT 'Referencia a auth.users.uuid (aprobador)',
    -- booking window
    title               VARCHAR(200)    NOT NULL COMMENT 'Título de la reserva',
    description         TEXT            NULL COMMENT 'Descripción de la reserva',
    booking_date        DATE            NOT NULL COMMENT 'Fecha de la reserva',
    start_time          TIME            NOT NULL COMMENT 'Hora de inicio',
    end_time            TIME            NOT NULL COMMENT 'Hora de fin',
    -- lifecycle timestamps
    requested_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de solicitud',
    approved_at         TIMESTAMP       NULL COMMENT 'Fecha de aprobación',
    cancelled_at        TIMESTAMP       NULL COMMENT 'Fecha de cancelación',
    completed_at        TIMESTAMP       NULL COMMENT 'Fecha de cierre/completado',
    cancellation_reason TEXT            NULL COMMENT 'Motivo de la cancelación',
    -- attendees / metadata
    expected_attendees  SMALLINT UNSIGNED NULL COMMENT 'Asistentes esperados',
    metadata            JSON            NULL COMMENT 'Metadatos adicionales',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_bookings_uuid             (uuid),
    UNIQUE KEY uq_bookings_reference        (reference_number),
    -- Prevent overlapping bookings on same resource
    UNIQUE KEY uq_bookings_slot             (resource_uuid, booking_date, start_time),
    CONSTRAINT chk_bookings_time            CHECK (end_time > start_time),
    KEY        fk_bookings_type             (booking_type_id),
    KEY        fk_bookings_status          (status_id),
    KEY        idx_bookings_resource        (resource_uuid),
    KEY        idx_bookings_requester       (requester_uuid),
    KEY        idx_bookings_date            (booking_date),
    CONSTRAINT fk_bookings_type
        FOREIGN KEY (booking_type_id) REFERENCES booking_types (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bookings_status
        FOREIGN KEY (status_id) REFERENCES booking_statuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Reservas de recursos';

-- ------------------------------------------------------------
-- booking_audit_trail
-- Registro inmutable de cada transición de estado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_audit_trail (
    id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    booking_id          INT UNSIGNED    NOT NULL COMMENT 'Reserva afectada',
    from_status_id      INT UNSIGNED    NULL COMMENT 'Estado anterior',
    to_status_id        INT UNSIGNED    NOT NULL COMMENT 'Estado nuevo',
    actor_uuid          CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (actor)',
    actor_name          VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del nombre del actor',
    comment             TEXT            NULL COMMENT 'Comentario de la transición',
    occurred_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de la transición',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_bat_uuid          (uuid),
    KEY        fk_bat_booking       (booking_id),
    KEY        fk_bat_from_status   (from_status_id),
    KEY        fk_bat_to_status     (to_status_id),
    CONSTRAINT fk_bat_booking
        FOREIGN KEY (booking_id) REFERENCES bookings (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_bat_from_status
        FOREIGN KEY (from_status_id) REFERENCES booking_statuses (id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_bat_to_status
        FOREIGN KEY (to_status_id) REFERENCES booking_statuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Rastro de auditoría inmutable de transiciones de estado de reservas';

SET FOREIGN_KEY_CHECKS = 1;
