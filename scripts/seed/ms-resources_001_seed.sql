-- ============================================================
-- SEEDER: uajs_resources — Catálogos de Recursos Físicos
-- Microservicio: ms-resources / resource-service
-- Descripción: Categorías y Estados operativos de activos reservables
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
    (1, 'rc000000-0000-0000-0000-000000000001', 'AULA', 'Aulas de Clase', 'school', 'Salones tradicionales y polivalentes de clase magistral.', 1),
    (2, 'rc000000-0000-0000-0000-000000000002', 'LAB_INF', 'Laboratorios de Informática', 'monitor', 'Salas con equipos de cómputo de alto rendimiento y software especializado.', 1),
    (3, 'rc000000-0000-0000-0000-000000000003', 'AUDITORIO', 'Auditorios y Teatros', 'presentation', 'Espacios de gran aforo para conferencias y eventos académicos.', 1),
    (4, 'rc000000-0000-0000-0000-000000000004', 'SALA_ESTUDIO', 'Salas de Estudio Grupal', 'users', 'Cubículos de biblioteca y trabajo en equipo.', 1),
    (5, 'rc000000-0000-0000-0000-000000000005', 'ESC_DEPORT', 'Escenarios Deportivos', 'activity', 'Canchas múltiples, gimnasio y polideportivo.', 1),
    (6, 'rc000000-0000-0000-0000-000000000006', 'AUDIOVISUAL', 'Equipos Audiovisuales', 'video', 'Video proyectores, cámaras profesionales y micrófonos.', 1)
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
    (1, 'rs000000-0000-0000-0000-000000000001', 'available',      'Disponible',           1, '#10B981', 1),
    (2, 'rs000000-0000-0000-0000-000000000002', 'reserved',       'Reservado',            0, '#3B82F6', 1),
    (3, 'rs000000-0000-0000-0000-000000000003', 'maintenance',    'En Mantenimiento',     0, '#F59E0B', 1),
    (4, 'rs000000-0000-0000-0000-000000000004', 'out_of_service', 'Fuera de Servicio',    0, '#EF4444', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_bookable = VALUES(is_bookable),
    color_hex   = VALUES(color_hex),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
