-- ============================================================
-- SEEDER: uajs_bookings — Catálogo base de tipos y estados de reserva
-- Microservicio: ms-bookings
-- Descripción: Sin estas filas, ReservaService#create no puede
--              resolver el tipo/estado inicial ('pending') y
--              cualquier POST /reservas falla con 404.
-- Ejecución:  mysql -h 127.0.0.1 -P 3307 -uroot -proot < ms-bookings_001_seed.sql
-- Idempotente: seguro de re-ejecutar (INSERT ... ON DUPLICATE KEY UPDATE).
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_bookings
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_bookings;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- booking_types
-- ------------------------------------------------------------
INSERT INTO booking_types (id, uuid, code, name, description, requires_approval, max_duration_minutes, advance_days_limit, is_active)
VALUES
    (1, UUID(), 'AULA',      'Reserva de aula',      'Uso de un aula para clase, tutoría o estudio en grupo.', 1, 240, 30, 1),
    (2, UUID(), 'LABORATORIO', 'Reserva de laboratorio', 'Uso de un laboratorio con equipo especializado.',      1, 180, 15, 1),
    (3, UUID(), 'AUDITORIO', 'Reserva de auditorio',  'Uso del auditorio para eventos institucionales.',        1, 480, 60, 1),
    (4, UUID(), 'EQUIPO',    'Préstamo de equipo',    'Préstamo de equipo audiovisual o portátil.',             0, 480, 7,  1)
ON DUPLICATE KEY UPDATE
    name                 = VALUES(name),
    description          = VALUES(description),
    requires_approval    = VALUES(requires_approval),
    max_duration_minutes = VALUES(max_duration_minutes),
    advance_days_limit   = VALUES(advance_days_limit),
    is_active            = VALUES(is_active);

-- ------------------------------------------------------------
-- booking_statuses
-- pending → approved → confirmed → completed
--    \-> rejected      \-> cancelled
-- ------------------------------------------------------------
INSERT INTO booking_statuses (id, uuid, code, name, is_terminal, color_hex, is_active)
VALUES
    (1, UUID(), 'pending',   'Pendiente',  0, '#F59E0B', 1),
    (2, UUID(), 'approved',  'Aprobada',   0, '#3B82F6', 1),
    (3, UUID(), 'rejected',  'Rechazada',  1, '#EF4444', 1),
    (4, UUID(), 'confirmed', 'Confirmada', 0, '#10B981', 1),
    (5, UUID(), 'cancelled', 'Cancelada',  1, '#6B7280', 1),
    (6, UUID(), 'completed', 'Completada', 1, '#059669', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_terminal = VALUES(is_terminal),
    color_hex   = VALUES(color_hex),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
