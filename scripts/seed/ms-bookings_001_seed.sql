-- ============================================================
-- SEEDER: uajs_bookings — Tipos y Estados de Reservas
-- Microservicio: ms-bookings / booking-service
-- Descripción: Catálogos para el motor de reservas y préstamos
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
    (1, 'bt000000-0000-0000-0000-000000000001', 'CLASE',       'Clase Académica',         'Reserva docente para impartición de asignatura o cátedra.', 0, 240, 30, 1),
    (2, 'bt000000-0000-0000-0000-000000000002', 'ESTUDIO',     'Estudio Grupal',          'Reserva de cubículo o sala de biblioteca por estudiantes.', 0, 120, 7, 1),
    (3, 'bt000000-0000-0000-0000-000000000003', 'EVENTO',      'Evento Institucional',    'Conferencias, foros o seminarios institucionales.', 1, 480, 60, 1),
    (4, 'bt000000-0000-0000-0000-000000000004', 'REUNION',     'Reunión Administrativa',  'Sesión de comités de facultad, consejos o decanatura.', 0, 180, 15, 1),
    (5, 'bt000000-0000-0000-0000-000000000005', 'MANTENIMIENTO','Mantenimiento Preventivo','Bloqueo técnico para reparación o aseo profundo.', 1, NULL, 30, 1)
ON DUPLICATE KEY UPDATE
    name                 = VALUES(name),
    description          = VALUES(description),
    requires_approval    = VALUES(requires_approval),
    max_duration_minutes = VALUES(max_duration_minutes),
    advance_days_limit   = VALUES(advance_days_limit),
    is_active            = VALUES(is_active);

-- ------------------------------------------------------------
-- booking_statuses
-- ------------------------------------------------------------
INSERT INTO booking_statuses (id, uuid, code, name, is_terminal, color_hex, is_active)
VALUES
    (1, 'bs000000-0000-0000-0000-000000000001', 'pending',   'Pendiente de Aprobación', 0, '#F59E0B', 1),
    (2, 'bs000000-0000-0000-0000-000000000002', 'approved',  'Aprobada',                0, '#10B981', 1),
    (3, 'bs000000-0000-0000-0000-000000000003', 'confirmed', 'Confirmada (Check-in)',   0, '#059669', 1),
    (4, 'bs000000-0000-0000-0000-000000000004', 'rejected',  'Rechazada',               1, '#EF4444', 1),
    (5, 'bs000000-0000-0000-0000-000000000005', 'cancelled', 'Cancelada por Usuario',  1, '#6B7280', 1),
    (6, 'bs000000-0000-0000-0000-000000000006', 'completed', 'Finalizada con Éxito',    1, '#3B82F6', 1),
    (7, 'bs000000-0000-0000-0000-000000000007', 'no_show',   'No Asistió (No-show)',    1, '#DC2626', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_terminal = VALUES(is_terminal),
    color_hex   = VALUES(color_hex),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
