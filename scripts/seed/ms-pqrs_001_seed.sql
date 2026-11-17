-- ============================================================
-- SEEDER: uajs_pqrs — Catálogo base de tipos y estados de PQRS
-- Microservicio: ms-pqrs
-- Descripción: Sin estas filas, PqrsService#create no puede
--              resolver el tipo/estado inicial ('pending') y
--              cualquier POST /pqrs falla con 404.
-- Ejecución:  mysql -h 127.0.0.1 -P 3307 -uroot -proot < ms-pqrs_001_seed.sql
-- Idempotente: seguro de re-ejecutar (INSERT ... ON DUPLICATE KEY UPDATE).
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_pqrs
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_pqrs;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- pqrs_types
-- Plazos alineados con la Ley 1755 de 2015 (derecho de petición
-- en Colombia): 15 días hábiles por defecto, salvo que se indique
-- otra cosa institucionalmente.
-- ------------------------------------------------------------
INSERT INTO pqrs_types (id, uuid, code, name, description, sla_days, is_active)
VALUES
    (1, UUID(), 'PETICION',     'Petición',     'Solicitud respetuosa de información o de una actuación.', 15, 1),
    (2, UUID(), 'QUEJA',        'Queja',        'Manifestación de inconformidad por la conducta de un servidor o dependencia.', 15, 1),
    (3, UUID(), 'RECLAMO',      'Reclamo',      'Exigencia por el incumplimiento de un derecho o servicio.', 15, 1),
    (4, UUID(), 'SUGERENCIA',   'Sugerencia',   'Propuesta para mejorar un servicio o proceso.', 15, 1),
    (5, UUID(), 'FELICITACION', 'Felicitación', 'Reconocimiento positivo a un servicio o funcionario.', 15, 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    description = VALUES(description),
    sla_days    = VALUES(sla_days),
    is_active   = VALUES(is_active);

-- ------------------------------------------------------------
-- pqrs_statuses
-- pending → in_review → responded → closed
-- ------------------------------------------------------------
INSERT INTO pqrs_statuses (id, uuid, code, name, is_terminal, color_hex, is_active)
VALUES
    (1, UUID(), 'pending',   'Pendiente',   0, '#F59E0B', 1),
    (2, UUID(), 'in_review', 'En revisión', 0, '#3B82F6', 1),
    (3, UUID(), 'responded', 'Respondida',  0, '#10B981', 1),
    (4, UUID(), 'closed',    'Cerrada',     1, '#6B7280', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_terminal = VALUES(is_terminal),
    color_hex   = VALUES(color_hex),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
