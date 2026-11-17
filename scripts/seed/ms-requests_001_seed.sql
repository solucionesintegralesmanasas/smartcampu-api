-- ============================================================
-- SEEDER: uajs_requests — Catálogo base de solicitudes (mesa de servicio)
-- Microservicio: ms-requests
-- Descripción: Sin estas filas, SolicitudService#create no puede
--              resolver el estado inicial ('pending') y cualquier
--              POST /solicitudes falla con 404.
-- Ejecución:  mysql -h 127.0.0.1 -P 3307 -uroot -proot < ms-requests_001_seed.sql
-- Idempotente: seguro de re-ejecutar (INSERT ... ON DUPLICATE KEY UPDATE).
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_requests
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_requests;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- request_categories
-- ------------------------------------------------------------
INSERT INTO request_categories (id, uuid, code, name, icon, sort_order, is_active)
VALUES
    (1, UUID(), 'CERTIFICADOS', 'Certificados y constancias', 'file-text',      1, 1),
    (2, UUID(), 'MATRICULA',    'Cambios de matrícula',       'clipboard-edit', 2, 1),
    (3, UUID(), 'APELACIONES',  'Apelaciones académicas',     'scale',          3, 1),
    (4, UUID(), 'GENERAL',      'Peticiones generales',       'help-circle',    4, 1)
ON DUPLICATE KEY UPDATE
    name       = VALUES(name),
    icon       = VALUES(icon),
    sort_order = VALUES(sort_order),
    is_active  = VALUES(is_active);

-- ------------------------------------------------------------
-- request_types
-- ------------------------------------------------------------
INSERT INTO request_types (id, uuid, category_id, code, name, description, requires_approval, sla_days, cost, is_active)
VALUES
    (1, UUID(), 1, 'CERT_NOTAS',    'Certificado de notas',        'Certificado oficial de calificaciones.',            1, 5,  25000, 1),
    (2, UUID(), 1, 'CERT_ESTUDIO',  'Constancia de estudios',      'Constancia de estudiante activo.',                  0, 3,  NULL,  1),
    (3, UUID(), 2, 'CAMBIO_GRUPO',  'Cambio de grupo',              'Solicitud de cambio de grupo/horario.',            1, 5,  NULL,  1),
    (4, UUID(), 2, 'RETIRO_MATERIA', 'Retiro de asignatura',        'Retiro de una asignatura matriculada.',            1, 10, NULL,  1),
    (5, UUID(), 3, 'APELACION_NOTA', 'Apelación de calificación',   'Apelación formal de una nota final.',              1, 15, NULL,  1),
    (6, UUID(), 4, 'PETICION_GRAL', 'Petición general',            'Cualquier petición que no encaje en otra categoría.', 1, 15, NULL, 1)
ON DUPLICATE KEY UPDATE
    name              = VALUES(name),
    description       = VALUES(description),
    requires_approval = VALUES(requires_approval),
    sla_days          = VALUES(sla_days),
    cost              = VALUES(cost),
    is_active         = VALUES(is_active);

-- ------------------------------------------------------------
-- request_statuses
-- pending → in_review → approved / rejected → closed
-- ------------------------------------------------------------
INSERT INTO request_statuses (id, uuid, code, name, is_terminal, color_hex, is_active)
VALUES
    (1, UUID(), 'pending',   'Pendiente',   0, '#F59E0B', 1),
    (2, UUID(), 'in_review', 'En revisión', 0, '#3B82F6', 1),
    (3, UUID(), 'approved',  'Aprobada',    0, '#10B981', 1),
    (4, UUID(), 'rejected',  'Rechazada',   0, '#EF4444', 1),
    (5, UUID(), 'closed',    'Cerrada',     1, '#6B7280', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_terminal = VALUES(is_terminal),
    color_hex   = VALUES(color_hex),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
