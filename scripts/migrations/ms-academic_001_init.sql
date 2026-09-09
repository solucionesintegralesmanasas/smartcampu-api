-- ============================================================
-- BASE DE DATOS: uajs_academic
-- Microservicio: ms-academic
-- Descripción: Dominio académico principal — sedes, facultades,
--              programas, personas, estudiantes y docentes.
--              Las referencias entre servicios usan uuid +
--              campos de instantánea desnormalizados (sin FK a
--              bases de datos externas).
-- Versión: 1.0.0
-- Autor: Darwin Montes
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_academic
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_academic;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- campuses  (sedes)
-- Sedes físicas de la universidad
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campuses (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    name        VARCHAR(100)    NOT NULL COMMENT 'Nombre de la sede',
    address     VARCHAR(200)    NULL COMMENT 'Dirección física',
    phone       VARCHAR(20)     NULL COMMENT 'Teléfono de contacto',
    email       VARCHAR(100)    NULL COMMENT 'Correo electrónico de contacto',
    city_uuid   CHAR(36)        NOT NULL COMMENT 'Referencia catalog.cities.uuid',
    city_name   VARCHAR(100)    NOT NULL COMMENT 'Instantánea desnormalizada del nombre de la ciudad',
    state_name  VARCHAR(100)    NOT NULL COMMENT 'Instantánea desnormalizada del nombre del departamento',
    is_main     TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '¿Es la sede principal?',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_campuses_uuid (uuid),
    UNIQUE KEY uq_campuses_name (name)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Sedes físicas de la universidad';

-- ------------------------------------------------------------
-- companies  (empresas externas)
-- Empresas externas para pasantías / convenios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid            CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    legal_name      VARCHAR(200)    NOT NULL COMMENT 'Razón social',
    trade_name      VARCHAR(200)    NULL COMMENT 'Nombre comercial',
    tax_id          VARCHAR(20)     NOT NULL COMMENT 'NIT',
    check_digit     CHAR(1)         NULL COMMENT 'Dígito de verificación',
    address         VARCHAR(200)    NULL COMMENT 'Dirección física',
    phone           VARCHAR(20)     NULL COMMENT 'Teléfono de contacto',
    email           VARCHAR(100)    NULL COMMENT 'Correo electrónico de contacto',
    city_uuid       CHAR(36)        NULL  COMMENT 'Referencia catalog.cities.uuid',
    city_name       VARCHAR(100)    NULL COMMENT 'Instantánea desnormalizada del nombre de la ciudad',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_companies_uuid   (uuid),
    UNIQUE KEY uq_companies_tax_id (tax_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Empresas externas (convenios, pasantías)';

-- ------------------------------------------------------------
-- persons
-- Personas naturales (estudiantes, docentes, personal admin)
-- Este es el registro maestro de todas las entidades humanas de la UAJS.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS persons (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    document_type_code  VARCHAR(10)     NOT NULL COMMENT 'Referencia catalog.document_types.code',
    document_number     VARCHAR(30)     NOT NULL COMMENT 'Número de documento de identidad',
    check_digit         CHAR(1)         NULL COMMENT 'Dígito de verificación',
    first_name          VARCHAR(50)     NOT NULL COMMENT 'Primer nombre',
    middle_name         VARCHAR(50)     NULL COMMENT 'Segundo nombre',
    last_name           VARCHAR(50)     NOT NULL COMMENT 'Primer apellido',
    second_last_name    VARCHAR(50)     NULL COMMENT 'Segundo apellido',
    date_of_birth       DATE            NULL COMMENT 'Fecha de nacimiento',
    gender              ENUM('M','F','X') NULL COMMENT 'Género: M=Masculino, F=Femenino, X=No binario',
    email               VARCHAR(150)    NULL COMMENT 'Correo electrónico',
    phone               VARCHAR(20)     NULL COMMENT 'Teléfono de contacto',
    address             VARCHAR(200)    NULL COMMENT 'Dirección de residencia',
    city_uuid           CHAR(36)        NULL  COMMENT 'Referencia catalog.cities.uuid',
    city_name           VARCHAR(100)    NULL  COMMENT 'Instantánea desnormalizada del nombre de la ciudad',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    deleted_at          TIMESTAMP       NULL     COMMENT 'Eliminación suave (soft delete)',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_persons_uuid     (uuid),
    UNIQUE KEY uq_persons_document (document_type_code, document_number),
    KEY        idx_persons_email   (email)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Registros maestros de personas naturales para todos los roles';

-- ------------------------------------------------------------
-- faculties  (facultades)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faculties (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid        CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    campus_id   INT UNSIGNED    NOT NULL COMMENT 'Sede a la que pertenece la facultad',
    code        VARCHAR(20)     NOT NULL COMMENT 'Código abreviado de la facultad',
    name        VARCHAR(150)    NOT NULL COMMENT 'Nombre de la facultad',
    dean_name   VARCHAR(100)    NULL COMMENT 'Nombre del decano',
    email       VARCHAR(100)    NULL COMMENT 'Correo de contacto de la facultad',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_faculties_uuid (uuid),
    UNIQUE KEY uq_faculties_code (code),
    UNIQUE KEY uq_faculties_name (name),
    KEY        fk_faculties_campus (campus_id),
    CONSTRAINT fk_faculties_campus
        FOREIGN KEY (campus_id) REFERENCES campuses (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Facultades académicas por sede';

-- ------------------------------------------------------------
-- programs  (programas académicos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    faculty_id          INT UNSIGNED    NOT NULL COMMENT 'Facultad a la que pertenece el programa',
    code                VARCHAR(20)     NOT NULL COMMENT 'Código abreviado del programa',
    name                VARCHAR(150)    NOT NULL COMMENT 'Nombre del programa académico',
    level               ENUM(
                            'undergraduate',
                            'specialization',
                            'masters',
                            'doctorate',
                            'technologist',
                            'technician'
                        )               NOT NULL COMMENT 'Nivel de formación: undergraduate=Pregrado, specialization=Especialización, masters=Maestría, doctorate=Doctorado, technologist=Tecnológico, technician=Técnico',
    duration_semesters  TINYINT UNSIGNED NOT NULL COMMENT 'Duración en semestres',
    total_credits       SMALLINT UNSIGNED NOT NULL COMMENT 'Total de créditos académicos',
    snies_code          VARCHAR(20)     NULL     COMMENT 'Código SNIES (MEN Colombia)',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_programs_uuid (uuid),
    UNIQUE KEY uq_programs_code (code),
    UNIQUE KEY uq_programs_name (name),
    KEY        fk_programs_faculty (faculty_id),
    CONSTRAINT fk_programs_faculty
        FOREIGN KEY (faculty_id) REFERENCES faculties (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Programas académicos (pregrado, posgrado, etc.)';

-- ------------------------------------------------------------
-- students  (estudiantes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    person_id           INT UNSIGNED    NOT NULL COMMENT 'Persona natural asociada',
    program_id          INT UNSIGNED    NOT NULL COMMENT 'Programa académico en el que está matriculado',
    -- auth cross-reference (uuid only — no FK to external DB)
    user_uuid           CHAR(36)        NULL     COMMENT 'Referencia auth.users.uuid',
    student_code        VARCHAR(20)     NOT NULL COMMENT 'Código de estudiante',
    enrollment_date     DATE            NOT NULL COMMENT 'Fecha de matrícula',
    graduation_date     DATE            NULL COMMENT 'Fecha de graduación',
    current_semester    TINYINT UNSIGNED NULL COMMENT 'Semestre actual cursando',
    gpa                 DECIMAL(4,2)    NULL     COMMENT 'Promedio acumulado',
    status              ENUM(
                            'active',
                            'inactive',
                            'graduated',
                            'withdrawn',
                            'suspended'
                        )               NOT NULL DEFAULT 'active' COMMENT 'Estado: active=Activo, inactive=Inactivo, graduated=Graduado, withdrawn=Retirado, suspended=Suspendido',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    deleted_at          TIMESTAMP       NULL COMMENT 'Eliminación suave (soft delete)',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_students_uuid         (uuid),
    UNIQUE KEY uq_students_code         (student_code),
    UNIQUE KEY uq_students_person       (person_id),
    KEY        fk_students_program      (program_id),
    KEY        idx_students_user_uuid   (user_uuid),
    CONSTRAINT fk_students_person
        FOREIGN KEY (person_id) REFERENCES persons (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_students_program
        FOREIGN KEY (program_id) REFERENCES programs (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Estudiantes matriculados';

-- ------------------------------------------------------------
-- teachers  (docentes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachers (
    id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT 'Identificador único interno',
    uuid                CHAR(36)        NOT NULL DEFAULT (UUID()) COMMENT 'Identificador público (UUID)',
    person_id           INT UNSIGNED    NOT NULL COMMENT 'Persona natural asociada',
    faculty_id          INT UNSIGNED    NOT NULL COMMENT 'Facultad a la que pertenece el docente',
    user_uuid           CHAR(36)        NULL     COMMENT 'Referencia auth.users.uuid',
    teacher_code        VARCHAR(20)     NOT NULL COMMENT 'Código de docente',
    contract_type       ENUM(
                            'full_time',
                            'part_time',
                            'visiting',
                            'honorary'
                        )               NOT NULL COMMENT 'Tipo de contratación: full_time=Tiempo completo, part_time=Medio tiempo, visiting=Visitante, honorary=Honorario',
    hire_date           DATE            NOT NULL COMMENT 'Fecha de contratación',
    termination_date    DATE            NULL COMMENT 'Fecha de terminación del contrato',
    academic_degree     VARCHAR(80)     NULL     COMMENT 'Título académico más alto obtenido',
    status              ENUM('active','inactive','retired') NOT NULL DEFAULT 'active' COMMENT 'Estado: active=Activo, inactive=Inactivo, retired=Jubilado',
    is_active           TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Registro activo (1) o inactivo (0)',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación',
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha y hora de última modificación',
    deleted_at          TIMESTAMP       NULL COMMENT 'Eliminación suave (soft delete)',
    --
    PRIMARY KEY (id),
    UNIQUE KEY uq_teachers_uuid         (uuid),
    UNIQUE KEY uq_teachers_code         (teacher_code),
    UNIQUE KEY uq_teachers_person       (person_id),
    KEY        fk_teachers_faculty      (faculty_id),
    KEY        idx_teachers_user_uuid   (user_uuid),
    CONSTRAINT fk_teachers_person
        FOREIGN KEY (person_id) REFERENCES persons (id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_teachers_faculty
        FOREIGN KEY (faculty_id) REFERENCES faculties (id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Personal docente';

SET FOREIGN_KEY_CHECKS = 1;
