-- ============================================================
-- SEEDER: uajs_resources — Catálogo base de categorías y estados de recurso
-- Microservicio: ms-resources
-- Descripción: Necesario para poder registrar recursos reservables
--              (aulas, laboratorios, etc.) desde el primer momento.
-- Ejecución:  mysql -h 127.0.0.1 -P 3307 -uroot -proot < ms-resources_001_seed.sql
-- Idempotente: seguro de re-ejecutar (INSERT ... ON DUPLICATE KEY UPDATE).
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_resources
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_resources;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- resource_categories
-- ------------------------------------------------------------
INSERT INTO resource_categories (id, uuid, code, name, icon, description, is_active)
VALUES
    (1, UUID(), 'AULA',        'Aula',        'presentation', 'Aulas de clase estándar.', 1),
    (2, UUID(), 'LABORATORIO', 'Laboratorio', 'flask-conical', 'Laboratorios con equipo especializado.', 1),
    (3, UUID(), 'AUDITORIO',   'Auditorio',   'theater',      'Espacios para eventos masivos.', 1),
    (4, UUID(), 'EQUIPO',      'Equipo',      'projector',    'Equipo audiovisual y portátiles prestables.', 1),
    (5, UUID(), 'VEHICULO',    'Vehículo',    'car',          'Vehículos institucionales.', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    icon        = VALUES(icon),
    description = VALUES(description),
    is_active   = VALUES(is_active);

-- ------------------------------------------------------------
-- resource_statuses
-- ------------------------------------------------------------
INSERT INTO resource_statuses (id, uuid, code, name, is_bookable, color_hex, is_active)
VALUES
    (1, UUID(), 'available',      'Disponible',        1, '#10B981', 1),
    (2, UUID(), 'maintenance',    'En mantenimiento',  0, '#F59E0B', 1),
    (3, UUID(), 'out_of_service', 'Fuera de servicio', 0, '#EF4444', 1),
    (4, UUID(), 'reserved',       'Reservado',         0, '#3B82F6', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_bookable = VALUES(is_bookable),
    color_hex   = VALUES(color_hex),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
