-- ============================================================
-- SEEDER: uajs_academic — Catálogos Académicos Maestros
-- Microservicio: ms-academic / university-service
-- Descripción: Población de Sedes (campuses), Facultades (faculties),
--              Programas Académicos (programs) y Empresas aliadas (companies).
-- Ejecución: mysql -h 127.0.0.1 -P 3306 -u root < ms-academic_001_seed.sql
-- Idempotente: seguro de re-ejecutar.
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_academic
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_academic;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- campuses (Sedes universitarias)
-- ------------------------------------------------------------
INSERT INTO campuses (id, uuid, name, address, phone, email, city_uuid, city_name, state_name, is_main, is_active)
VALUES
    (1, 'c0000000-0000-0000-0000-000000000001', 'Sede Principal - Campus Central', 'Carrera 27 # 9-01', '+57 607 6344000', 'campus.central@uajs.edu.co', UUID(), 'Bucaramanga', 'Santander', 1, 1),
    (2, 'c0000000-0000-0000-0000-000000000002', 'Sede Floridablanca - Salud', 'Autopista Floridablanca # 156-40', '+57 607 6388000', 'salud.florida@uajs.edu.co', UUID(), 'Floridablanca', 'Santander', 0, 1),
    (3, 'c0000000-0000-0000-0000-000000000003', 'Sede Regional Barrancabermeja', 'Calle 50 # 18-25', '+57 607 6223000', 'regional.barranca@uajs.edu.co', UUID(), 'Barrancabermeja', 'Santander', 0, 1)
ON DUPLICATE KEY UPDATE
    name       = VALUES(name),
    address    = VALUES(address),
    phone      = VALUES(phone),
    email      = VALUES(email),
    city_name  = VALUES(city_name),
    state_name = VALUES(state_name),
    is_main    = VALUES(is_main),
    is_active  = VALUES(is_active);

-- ------------------------------------------------------------
-- faculties (Facultades académicas por sede)
-- ------------------------------------------------------------
INSERT INTO faculties (id, uuid, campus_id, code, name, dean_name, email, is_active)
VALUES
    (1, 'f0000000-0000-0000-0000-000000000001', 1, 'FAC-ING', 'Facultad de Ingenierías y Tecnologías', 'Ing. Carlos Alberto Morales', 'ingenieria@uajs.edu.co', 1),
    (2, 'f0000000-0000-0000-0000-000000000002', 2, 'FAC-SAL', 'Facultad de Ciencias de la Salud', 'Dra. María Patricia Gómez', 'salud@uajs.edu.co', 1),
    (3, 'f0000000-0000-0000-0000-000000000003', 1, 'FAC-ECO', 'Facultad de Ciencias Económicas y Administrativas', 'Dr. Jorge Enrique Silva', 'ciencias.economicas@uajs.edu.co', 1),
    (4, 'f0000000-0000-0000-0000-000000000004', 1, 'FAC-BAS', 'Facultad de Ciencias Básicas y Humanidades', 'Dra. Diana Carolina Parra', 'ciencias.basicas@uajs.edu.co', 1)
ON DUPLICATE KEY UPDATE
    campus_id = VALUES(campus_id),
    name      = VALUES(name),
    dean_name = VALUES(dean_name),
    email     = VALUES(email),
    is_active = VALUES(is_active);

-- ------------------------------------------------------------
-- programs (Programas académicos de pregrado y posgrado)
-- ------------------------------------------------------------
INSERT INTO programs (id, uuid, faculty_id, code, name, level, duration_semesters, total_credits, snies_code, is_active)
VALUES
    (1, 'p0000000-0000-0000-0000-000000000001', 1, 'PRG-SIS', 'Ingeniería de Sistemas y Computación', 'undergraduate', 10, 160, '102580', 1),
    (2, 'p0000000-0000-0000-0000-000000000002', 1, 'PRG-SOF', 'Ingeniería de Software', 'undergraduate', 8, 140, '109340', 1),
    (3, 'p0000000-0000-0000-0000-000000000003', 2, 'PRG-MED', 'Medicina General', 'undergraduate', 12, 220, '103450', 1),
    (4, 'p0000000-0000-0000-0000-000000000004', 2, 'PRG-ENF', 'Enfermería', 'undergraduate', 8, 150, '104230', 1),
    (5, 'p0000000-0000-0000-0000-000000000005', 3, 'PRG-ADM', 'Administración de Empresas', 'undergraduate', 9, 155, '101230', 1),
    (6, 'p0000000-0000-0000-0000-000000000006', 1, 'PRG-MSI', 'Maestría en Seguridad de la Información', 'masters', 4, 48, '108990', 1)
ON DUPLICATE KEY UPDATE
    faculty_id         = VALUES(faculty_id),
    name               = VALUES(name),
    level              = VALUES(level),
    duration_semesters = VALUES(duration_semesters),
    total_credits      = VALUES(total_credits),
    snies_code         = VALUES(snies_code),
    is_active          = VALUES(is_active);

INSERT INTO companies (
    id,
    uuid,
    legal_name,
    trade_name,
    tax_id,
    check_digit,
    address,
    phone,
    email,
    city_name,
    is_active
)
VALUES (
    1,
    'b0000000-0000-0000-0000-000000000001',
    'Corporación Universitaria de Sucre',
    'CORPOSUCRE',
    '900867719',
    '4',
    'Sincelejo, Sucre',
    '+57 605 274 8900',
    'info@corposucre.edu.co',
    'Sincelejo',
    1
)
ON DUPLICATE KEY UPDATE
    legal_name = VALUES(legal_name),
    trade_name = VALUES(trade_name),
    tax_id     = VALUES(tax_id),
    address    = VALUES(address),
    phone      = VALUES(phone),
    email      = VALUES(email),
    city_name  = VALUES(city_name),
    is_active  = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
