-- ============================================================
-- SEEDER: uajs_events — Catálogo base de categorías y estados de evento
-- Microservicio: ms-events
-- Descripción: Sin estas filas, EventoService#create no puede
--              resolver el estado inicial ('draft') y cualquier
--              POST /eventos falla con 404.
-- Ejecución:  mysql -h 127.0.0.1 -P 3307 -uroot -proot < ms-events_001_seed.sql
-- Idempotente: seguro de re-ejecutar (INSERT ... ON DUPLICATE KEY UPDATE).
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
    (1, UUID(), 'ACADEMICO',  'Académico',  '#3B82F6', 'graduation-cap', 1),
    (2, UUID(), 'CULTURAL',   'Cultural',   '#8B5CF6', 'palette',        1),
    (3, UUID(), 'DEPORTIVO',  'Deportivo',  '#10B981', 'trophy',         1),
    (4, UUID(), 'TALLER',     'Taller',     '#F59E0B', 'wrench',         1),
    (5, UUID(), 'BIENESTAR',  'Bienestar',  '#EC4899', 'heart',          1)
ON DUPLICATE KEY UPDATE
    name      = VALUES(name),
    color_hex = VALUES(color_hex),
    icon      = VALUES(icon),
    is_active = VALUES(is_active);

-- ------------------------------------------------------------
-- event_statuses
-- draft → published → ongoing → completed
--                  \-> cancelled (desde cualquiera de los tres primeros)
-- ------------------------------------------------------------
INSERT INTO event_statuses (id, uuid, code, name, is_terminal, is_active)
VALUES
    (1, UUID(), 'draft',     'Borrador',    0, 1),
    (2, UUID(), 'published', 'Publicado',   0, 1),
    (3, UUID(), 'ongoing',   'En curso',    0, 1),
    (4, UUID(), 'completed', 'Finalizado',  1, 1),
    (5, UUID(), 'cancelled', 'Cancelado',   1, 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_terminal = VALUES(is_terminal),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
