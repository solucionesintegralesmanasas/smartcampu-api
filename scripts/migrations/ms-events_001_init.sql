-- ============================================================
-- BASE DE DATOS: uajs_events
-- Microservicio: ms-events
-- Descripción: Eventos universitarios — académicos, culturales,
--              deportivos, talleres. Incluye inscripción, control
--              de capacidad y seguimiento de asistencia.
-- Versión: 1.0.0
-- Autor: Darwin Montes
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_events
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_events;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- event_categories
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_categories (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Código abreviado de la categoría',
    name        VARCHAR(50)     NOT NULL COMMENT 'Nombre de la categoría',
    color_hex   CHAR(7)         NULL     COMMENT 'Color para la insignia del calendario',
    icon        VARCHAR(60)     NULL COMMENT 'Identificador del icono (lucide / font-awesome)',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_event_categories_uuid (uuid),
    UNIQUE KEY uq_event_categories_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de categorías de eventos';

-- ------------------------------------------------------------
-- event_statuses
-- draft → published → ongoing → completed | cancelled
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_statuses (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Código del estado (draft|published|ongoing|completed|cancelled)',
    name        VARCHAR(50)     NOT NULL COMMENT 'Nombre legible del estado',
    is_terminal TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'No admite más transiciones (estado final)',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_event_statuses_uuid (uuid),
    UNIQUE KEY uq_event_statuses_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Estados del ciclo de vida del evento';

-- ------------------------------------------------------------
-- events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    category_id         INT UNSIGNED    NOT NULL COMMENT 'Categoría del evento',
    status_id           INT UNSIGNED    NOT NULL COMMENT 'Estado actual del evento',
    -- cross-service references (uuid snapshots)
    organizer_uuid      CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (organizador)',
    organizer_name      VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del organizador',
    campus_uuid         CHAR(36)        NOT NULL COMMENT 'Referencia a academic.campuses.uuid',
    campus_name         VARCHAR(100)    NOT NULL COMMENT 'Instantánea desnormalizada de la sede',
    -- event data
    title               VARCHAR(200)    NOT NULL COMMENT 'Título del evento',
    slug                VARCHAR(220)    NULL     COMMENT 'Identificador compatible con URL',
    description         TEXT            NULL COMMENT 'Descripción del evento',
    venue               VARCHAR(200)    NULL     COMMENT 'Salón/ubicación específica dentro de la sede',
    starts_at           TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de inicio',
    ends_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de fin',
    max_capacity        INT UNSIGNED    NULL     COMMENT 'Aforo máximo (NULL = ilimitado)',
    cost                DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT 'Costo del evento (COP)',
    requires_registration TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '¿Requiere inscripción previa?',
    registration_deadline TIMESTAMP    NULL COMMENT 'Fecha límite de inscripción',
    cover_image_uuid    CHAR(36)        NULL     COMMENT 'Referencia al archivo de portada (ms-files)',
    metadata            JSON            NULL COMMENT 'Metadatos adicionales',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_events_uuid       (uuid),
    UNIQUE KEY uq_events_slug       (slug),
    CONSTRAINT chk_events_dates     CHECK (ends_at > starts_at),
    KEY        fk_events_category   (category_id),
    KEY        fk_events_status     (status_id),
    KEY        idx_events_organizer (organizer_uuid),
    KEY        idx_events_campus    (campus_uuid),
    KEY        idx_events_dates     (starts_at, ends_at),
    CONSTRAINT fk_events_category
        FOREIGN KEY (category_id) REFERENCES event_categories (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_events_status
        FOREIGN KEY (status_id) REFERENCES event_statuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Eventos universitarios';

-- ------------------------------------------------------------
-- event_registrations
-- Inscripciones de participantes con flujo de aprobación
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_registrations (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    event_id        INT UNSIGNED    NOT NULL COMMENT 'Evento al que se inscribe',
    registrant_uuid CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid',
    registrant_name VARCHAR(120)    NOT NULL COMMENT 'Instantánea desnormalizada del inscrito',
    status          ENUM('pending','confirmed','waitlisted','cancelled','attended') NOT NULL DEFAULT 'pending' COMMENT 'Estado: pending=Pendiente, confirmed=Confirmado, waitlisted=En lista de espera, cancelled=Cancelado, attended=Asistió',
    registered_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de inscripción',
    confirmed_at    TIMESTAMP       NULL COMMENT 'Fecha de confirmación',
    cancelled_at    TIMESTAMP       NULL COMMENT 'Fecha de cancelación',
    attended_at     TIMESTAMP       NULL COMMENT 'Fecha de registro de asistencia (check-in)',
    qr_code         VARCHAR(255)    NULL     COMMENT 'Carga útil del código QR para check-in',
    notes           TEXT            NULL COMMENT 'Notas de la inscripción',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_event_registrations_uuid          (uuid),
    UNIQUE KEY uq_event_registrations_participant   (event_id, registrant_uuid),
    KEY        fk_er_event                          (event_id),
    KEY        idx_er_registrant                    (registrant_uuid),
    CONSTRAINT fk_er_event
        FOREIGN KEY (event_id) REFERENCES events (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Inscripciones de participantes a eventos';

SET FOREIGN_KEY_CHECKS = 1;
