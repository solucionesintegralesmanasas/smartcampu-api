-- ============================================================
-- BASE DE DATOS: uajs_resources
-- Microservicio: ms-resources
-- Descripción: Recursos físicos del campus — aulas, laboratorios,
--              equipos, vehículos, salas de reunión. La
--              disponibilidad de los recursos es leída por ms-bookings.
-- Versión: 1.0.0
-- Autor: Darwin Montes
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_resources
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_resources;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- resource_categories
-- Agrupación de alto nivel (aula, laboratorio, vehículo, equipo…)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_categories (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Código abreviado de la categoría',
    name        VARCHAR(50)     NOT NULL COMMENT 'Nombre de la categoría',
    icon        VARCHAR(60)     NULL     COMMENT 'Identificador del icono (lucide / font-awesome)',
    description TEXT            NULL COMMENT 'Descripción de la categoría',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_resource_categories_uuid (uuid),
    UNIQUE KEY uq_resource_categories_code (code),
    UNIQUE KEY uq_resource_categories_name (name)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de categorías de recursos';

-- ------------------------------------------------------------
-- resource_statuses
-- Valores de la máquina de estados operativos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_statuses (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code        VARCHAR(20)     NOT NULL COMMENT 'Estado: available=Disponible, maintenance=Mantenimiento, out_of_service=Fuera de servicio, reserved=Reservado',
    name        VARCHAR(50)     NOT NULL COMMENT 'Nombre legible del estado',
    is_bookable TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '¿Se pueden hacer reservas en este estado?',
    color_hex   CHAR(7)         NULL     COMMENT 'Color para la insignia de UI',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_resource_statuses_uuid (uuid),
    UNIQUE KEY uq_resource_statuses_code (code)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Estados operativos de los recursos';

-- ------------------------------------------------------------
-- resources
-- Activos físicos reservables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resources (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    category_id     INT UNSIGNED    NOT NULL COMMENT 'Categoría del recurso',
    status_id       INT UNSIGNED    NOT NULL COMMENT 'Estado operativo actual',
    -- campus reference (cross-service snapshot)
    campus_uuid     CHAR(36)        NOT NULL COMMENT 'Referencia a academic.campuses.uuid',
    campus_name     VARCHAR(100)    NOT NULL COMMENT 'Instantánea desnormalizada de la sede',
    code            VARCHAR(30)     NOT NULL COMMENT 'Código abreviado del recurso',
    name            VARCHAR(100)    NOT NULL COMMENT 'Nombre del recurso',
    description     TEXT            NULL COMMENT 'Descripción del recurso',
    capacity        INT UNSIGNED    NULL     COMMENT 'Capacidad máxima de personas (salas/vehículos)',
    floor           VARCHAR(10)     NULL COMMENT 'Piso donde se ubica',
    building        VARCHAR(50)     NULL COMMENT 'Edificio donde se ubica',
    has_inventory   TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '¿El recurso maneja inventario?',
    attributes      JSON            NULL     COMMENT 'Conjunto flexible de características (proyector, AC, WiFi…)',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_resources_uuid        (uuid),
    UNIQUE KEY uq_resources_code        (code),
    KEY        fk_resources_category    (category_id),
    KEY        fk_resources_status      (status_id),
    KEY        idx_resources_campus     (campus_uuid),
    CONSTRAINT fk_resources_category
        FOREIGN KEY (category_id) REFERENCES resource_categories (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_resources_status
        FOREIGN KEY (status_id) REFERENCES resource_statuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Recursos físicos reservables';

-- ------------------------------------------------------------
-- resource_schedules
-- Ventanas operativas por recurso (¿cuándo se puede reservar?)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_schedules (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    resource_id     INT UNSIGNED    NOT NULL COMMENT 'Recurso al que pertenece la programación',
    day_of_week     TINYINT UNSIGNED NOT NULL COMMENT 'Día de la semana: 0=Domingo … 6=Sábado (ISO: 1=Lunes)',
    open_time       TIME            NOT NULL COMMENT 'Hora de apertura',
    close_time      TIME            NOT NULL COMMENT 'Hora de cierre',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Programación activa (1) o inactiva (0)',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_resource_schedules_uuid   (uuid),
    UNIQUE KEY uq_resource_schedules_slot   (resource_id, day_of_week),
    CONSTRAINT chk_resource_schedules_hours CHECK (close_time > open_time),
    KEY        fk_rsch_resource             (resource_id),
    CONSTRAINT fk_rsch_resource
        FOREIGN KEY (resource_id) REFERENCES resources (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Programación semanal de operación por recurso';

-- ------------------------------------------------------------
-- resource_blackouts
-- Cierres excepcionales (festivos, ventanas de mantenimiento)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_blackouts (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    resource_id     INT UNSIGNED    NOT NULL COMMENT 'Recurso con la indisponibilidad',
    starts_at       DATETIME        NOT NULL COMMENT 'Inicio del bloqueo',
    ends_at         DATETIME        NOT NULL COMMENT 'Fin del bloqueo',
    reason          VARCHAR(200)    NOT NULL COMMENT 'Motivo de la indisponibilidad',
    created_by_uuid CHAR(36)        NOT NULL COMMENT 'Referencia a auth.users.uuid (quien creó)',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_resource_blackouts_uuid (uuid),
    CONSTRAINT chk_resource_blackouts_range CHECK (ends_at > starts_at),
    KEY        fk_rb_resource (resource_id),
    CONSTRAINT fk_rb_resource
        FOREIGN KEY (resource_id) REFERENCES resources (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Ventanas excepcionales de indisponibilidad de recursos';

-- ------------------------------------------------------------
-- inventory_items
-- Elementos individuales dentro de un recurso que tiene inventario
-- ej., proyectores, sillas, computadores dentro de una sala
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    resource_id     INT UNSIGNED    NOT NULL COMMENT 'Recurso al que pertenece el elemento',
    serial_number   VARCHAR(80)     NULL COMMENT 'Número de serie',
    description     VARCHAR(200)    NOT NULL COMMENT 'Descripción del elemento',
    quantity        INT UNSIGNED    NOT NULL DEFAULT 1 COMMENT 'Cantidad del elemento',
    unit            VARCHAR(20)     NOT NULL DEFAULT 'unit' COMMENT 'Unidad de medida',
    condition_code  ENUM('new','good','fair','damaged','decommissioned') NOT NULL DEFAULT 'good' COMMENT 'Condición: new=Nuevo, good=Bueno, fair=Regular, damaged=Dañado, decommissioned=Retirado del servicio',
    acquired_at     DATE            NULL COMMENT 'Fecha de adquisición',
    attributes      JSON            NULL COMMENT 'Atributos adicionales',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_items_uuid          (uuid),
    KEY        fk_inventory_items_resource      (resource_id),
    CONSTRAINT fk_inventory_items_resource
        FOREIGN KEY (resource_id) REFERENCES resources (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Elementos dentro de recursos que manejan inventario';

SET FOREIGN_KEY_CHECKS = 1;
