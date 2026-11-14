-- ============================================================
-- SEEDER: uajs_pqrs — Tipos y Estados de PQRS
-- Microservicio: ms-pqrs / pqrs-service
-- Descripción: Catálogos base. Idempotente (ON DUPLICATE KEY UPDATE).
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_pqrs
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_pqrs;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- pqrs_types
-- ------------------------------------------------------------
INSERT INTO pqrs_types (id, uuid, code, name, response_days_business, is_active)
VALUES
    (1, 'pt000000-0000-0000-0000-000000000001', 'PETICION',     'Petición',     15, 1),
    (2, 'pt000000-0000-0000-0000-000000000002', 'QUEJA',        'Queja',        15, 1),
    (3, 'pt000000-0000-0000-0000-000000000003', 'RECLAMO',      'Reclamo',      15, 1),
    (4, 'pt000000-0000-0000-0000-000000000004', 'SUGERENCIA',   'Sugerencia',   15, 1),
    (5, 'pt000000-0000-0000-0000-000000000005', 'FELICITACION', 'Felicitación', 15, 1)
ON DUPLICATE KEY UPDATE
    name                   = VALUES(name),
    response_days_business = VALUES(response_days_business),
    is_active              = VALUES(is_active);

-- ------------------------------------------------------------
-- pqrs_statuses
-- ------------------------------------------------------------
INSERT INTO pqrs_statuses (id, uuid, code, name, is_terminal, color_hex, is_active)
VALUES
    (1, 'ps000000-0000-0000-0000-000000000001', 'radicada',   'Radicada',   0, '#3B82F6', 1),
    (2, 'ps000000-0000-0000-0000-000000000002', 'en_tramite', 'En trámite', 0, '#F59E0B', 1),
    (3, 'ps000000-0000-0000-0000-000000000003', 'respondida', 'Respondida', 0, '#10B981', 1),
    (4, 'ps000000-0000-0000-0000-000000000004', 'cerrada',    'Cerrada',    1, '#6B7280', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_terminal = VALUES(is_terminal),
    color_hex   = VALUES(color_hex),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
