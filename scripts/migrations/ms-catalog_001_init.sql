-- ============================================================
-- BASE DE DATOS: uajs_catalog
-- Microservicio: ms-catalog
-- Descripción: Datos maestros/referenciales compartidos que todos
--              los microservicios consumen vía réplicas de solo
--              lectura o llamadas API. Aquí no vive lógica de
--              negocio — solo datos maestros puros.
-- Versión: 1.0.0
-- Autor: Darwin Montes
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_catalog
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_catalog;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- countries
-- Catálogo de países conforme a ISO 3166-1
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid          CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    iso_code      CHAR(2)         NOT NULL COMMENT 'Código ISO 3166-1 alpha-2',
    iso_code_3    CHAR(3)         NULL     COMMENT 'Código ISO 3166-1 alpha-3',
    name          VARCHAR(100)    NOT NULL COMMENT 'Nombre oficial del país',
    phone_code    VARCHAR(10)     NULL COMMENT 'Prefijo telefónico internacional',
    is_active     TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_countries_uuid     (uuid),
    UNIQUE KEY uq_countries_iso_code (iso_code),
    UNIQUE KEY uq_countries_name     (name)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Datos maestros de países ISO 3166-1';

-- ------------------------------------------------------------
-- departments
-- Divisiones administrativas de primer nivel (departamentos en Colombia)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid          CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    country_id    INT UNSIGNED    NOT NULL COMMENT 'País al que pertenece el departamento',
    dane_code     VARCHAR(10)     NULL     COMMENT 'Código geográfico DANE (Colombia)',
    name          VARCHAR(100)    NOT NULL COMMENT 'Nombre del departamento/estado',
    is_active     TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_departments_uuid              (uuid),
    UNIQUE KEY uq_departments_name_country      (name, country_id),
    KEY        fk_departments_country           (country_id),
    CONSTRAINT fk_departments_country
        FOREIGN KEY (country_id) REFERENCES countries (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Estados/departamentos administrativos';

-- ------------------------------------------------------------
-- cities
-- Divisiones administrativas de segundo nivel (municipios en Colombia)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cities (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid          CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    state_id      INT UNSIGNED    NOT NULL COMMENT 'Departamento al que pertenece el municipio',
    dane_code     VARCHAR(10)     NULL     COMMENT 'Código geográfico DANE (Colombia)',
    name          VARCHAR(100)    NOT NULL COMMENT 'Nombre del municipio/ciudad',
    is_active     TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_cities_uuid         (uuid),
    UNIQUE KEY uq_cities_name_state   (name, state_id),
    KEY        fk_cities_state        (state_id),
    CONSTRAINT fk_cities_state
        FOREIGN KEY (state_id) REFERENCES departments (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Ciudades / municipios';

-- ------------------------------------------------------------
-- document_types
-- Tipos de documento de identidad (CC, TI, NIT, Pasaporte, etc.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_types (
    id                          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    code                        VARCHAR(10)     NOT NULL COMMENT 'Código abreviado, ej. CC, TI, NIT, CE, PAS',
    name                        VARCHAR(50)     NOT NULL COMMENT 'Nombre del tipo de documento',
    requires_check_digit        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '¿Requerir dígito de verificación?',
    applies_to_natural_person   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '¿Aplica a personas naturales?',
    applies_to_legal_entity     TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '¿Aplica a personas jurídicas?',
    is_active                   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at                  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at                  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_document_types_uuid (uuid),
    UNIQUE KEY uq_document_types_code (code),
    UNIQUE KEY uq_document_types_name (name)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Catálogo de tipos de documento de identidad';

-- ------------------------------------------------------------
-- campuses
-- Sedes y campus físicos universitarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campuses (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid          CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    city_id       INT UNSIGNED    NOT NULL COMMENT 'ID de la ciudad a la que pertenece',
    name          VARCHAR(100)    NOT NULL COMMENT 'Nombre de la sede/campus',
    address       VARCHAR(200)    NULL     COMMENT 'Dirección de la sede',
    phone         VARCHAR(20)     NULL     COMMENT 'Teléfono de contacto',
    is_active     TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_campuses_uuid     (uuid),
    UNIQUE KEY uq_campuses_name     (name),
    KEY        fk_campuses_city     (city_id),
    CONSTRAINT fk_campuses_city
        FOREIGN KEY (city_id) REFERENCES cities (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Sedes / Campus universitarios';

-- ------------------------------------------------------------
-- Vista de compatibilidad para código legacy (sedes)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW sedes AS
SELECT
    id AS id_sede,
    uuid,
    name AS nombre,
    address AS direccion,
    phone AS telefono,
    city_id AS id_ciudad,
    is_active AS activo,
    created_at,
    updated_at
FROM campuses;

SET FOREIGN_KEY_CHECKS = 1;
