-- ============================================================
-- SEEDER: uajs_events — Categorías y Estados de Eventos
-- Microservicio: ms-events / event-service
-- Descripción: Catálogos para el calendario institucional y eventos
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
INSERT INTO event_categories (id, uuid, code, name, color_hex, icon, is_active)
VALUES
    (1, 'ec000000-0000-0000-0000-000000000001', 'ACADEMICO',   'Académico y Científico', '#2563EB', 'book-open', 1),
    (2, 'ec000000-0000-0000-0000-000000000002', 'CULTURAL',    'Arte y Cultura',         '#7C3AED', 'music',     1),
    (3, 'ec000000-0000-0000-0000-000000000003', 'DEPORTIVO',   'Deportes y Bienestar',   '#059669', 'trophy',    1),
    (4, 'ec000000-0000-0000-0000-000000000004', 'CONGRESO',    'Congresos y Simposios',  '#D97706', 'globe',     1),
    (5, 'ec000000-0000-0000-0000-000000000005', 'INSTITUCIONAL','Institucional y Protocolo','#DC2626','landmark',  1)
ON DUPLICATE KEY UPDATE
    name      = VALUES(name),
    color_hex = VALUES(color_hex),
    icon      = VALUES(icon),
    is_active = VALUES(is_active);

-- ------------------------------------------------------------
-- event_statuses
-- ------------------------------------------------------------
INSERT INTO event_statuses (id, uuid, code, name, is_terminal, is_active)
VALUES
    (1, 'es000000-0000-0000-0000-000000000001', 'draft',     'Borrador',              0, 1),
    (2, 'es000000-0000-0000-0000-000000000002', 'published', 'Publicado / Inscripciones Abiertas', 0, 1),
    (3, 'es000000-0000-0000-0000-000000000003', 'ongoing',   'En Progreso',           0, 1),
    (4, 'es000000-0000-0000-0000-000000000004', 'completed', 'Finalizado',            1, 1),
    (5, 'es000000-0000-0000-0000-000000000005', 'cancelled', 'Cancelado',             1, 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_terminal = VALUES(is_terminal),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
