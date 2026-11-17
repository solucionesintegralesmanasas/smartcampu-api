-- ============================================================
-- SEEDER: uajs_academic — Sede principal, facultades y programas base
-- Microservicio: ms-academic
-- Descripción: Datos mínimos para que resource-service/booking-service
--              y el frontend tengan una sede/facultad/programa reales
--              con los que trabajar desde el primer arranque.
-- Requiere: haber corrido antes ms-catalog_001_seed.sql (se referencia
--           su ciudad de Bogotá por dane_code vía subconsulta entre
--           bases de datos del mismo servidor MySQL).
-- Ejecución:  mysql -h 127.0.0.1 -P 3307 -uroot -proot < ms-academic_001_seed.sql
-- Idempotente: seguro de re-ejecutar (INSERT ... ON DUPLICATE KEY UPDATE).
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_academic
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_academic;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- campuses — sede principal (Bogotá D.C.)
-- ------------------------------------------------------------
INSERT INTO campuses (id, uuid, name, address, phone, email, city_uuid, city_name, state_name, is_main, is_active)
VALUES (
    1, UUID(), 'Sede Principal',
    'Cra. 7 # 40-53, Bogotá D.C.', '+57 1 3238000', 'contacto@uajs.edu.co',
    COALESCE((SELECT uuid FROM uajs_catalog.cities WHERE dane_code = '11001' LIMIT 1), UUID()),
    'Bogotá D.C.', 'Bogotá D.C.', 1, 1
)
ON DUPLICATE KEY UPDATE
    address    = VALUES(address),
    phone      = VALUES(phone),
    email      = VALUES(email),
    city_name  = VALUES(city_name),
    state_name = VALUES(state_name),
    is_main    = VALUES(is_main),
    is_active  = VALUES(is_active);

-- ------------------------------------------------------------
-- faculties
-- ------------------------------------------------------------
INSERT INTO faculties (id, uuid, campus_id, code, name, dean_name, email, is_active)
VALUES
    (1, UUID(), 1, 'ING', 'Facultad de Ingeniería',              NULL, 'ingenieria@uajs.edu.co', 1),
    (2, UUID(), 1, 'ECO', 'Facultad de Ciencias Económicas',     NULL, 'economicas@uajs.edu.co', 1),
    (3, UUID(), 1, 'SAL', 'Facultad de Ciencias de la Salud',    NULL, 'salud@uajs.edu.co',       1)
ON DUPLICATE KEY UPDATE
    name      = VALUES(name),
    email     = VALUES(email),
    is_active = VALUES(is_active);

-- ------------------------------------------------------------
-- programs
-- ------------------------------------------------------------
INSERT INTO programs (id, uuid, faculty_id, code, name, level, duration_semesters, total_credits, snies_code, is_active)
VALUES
    (1, UUID(), 1, 'ISIS', 'Ingeniería de Sistemas',       'undergraduate', 10, 160, '10101', 1),
    (2, UUID(), 1, 'IIND', 'Ingeniería Industrial',        'undergraduate', 10, 160, '10102', 1),
    (3, UUID(), 2, 'ADM',  'Administración de Empresas',   'undergraduate', 9,  144, '10103', 1),
    (4, UUID(), 3, 'ENF',  'Enfermería',                   'undergraduate', 8,  130, '10104', 1)
ON DUPLICATE KEY UPDATE
    name               = VALUES(name),
    level              = VALUES(level),
    duration_semesters = VALUES(duration_semesters),
    total_credits      = VALUES(total_credits),
    snies_code         = VALUES(snies_code),
    is_active          = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
