-- ============================================================
-- SEEDER: uajs_requests — Categorías, Tipos y Estados de Trámites
-- Microservicio: ms-requests / request-service
-- Descripción: Catálogos para el módulo de ventanilla única y PQRS
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
    (1, 'qc000000-0000-0000-0000-000000000001', 'CERTIFICADOS', 'Certificaciones Académicas', 'file-text', 1, 1),
    (2, 'qc000000-0000-0000-0000-000000000002', 'ACADEMICOS',   'Trámites Curriculares',       'book-check', 2, 1),
    (3, 'qc000000-0000-0000-0000-000000000003', 'FINANCIEROS',  'Trámites de Cartera y Pagos', 'credit-card',3, 1),
    (4, 'qc000000-0000-0000-0000-000000000004', 'SOPORTE_TI',   'Soporte Tecnológico del Campus','cpu',       4, 1)
ON DUPLICATE KEY UPDATE
    name       = VALUES(name),
    icon       = VALUES(icon),
    sort_order = VALUES(sort_order),
    is_active  = VALUES(is_active);

-- ------------------------------------------------------------
-- request_types
-- ------------------------------------------------------------
INSERT INTO request_types (
    id, uuid, category_id, code, name, description,
    requires_approval, sla_days, cost, form_schema, is_active
)
VALUES
    (1, 'qt000000-0000-0000-0000-000000000001', 1, 'CERT_ESTUDIO', 'Certificado de Estudio Regular',
     'Documento oficial que acredita la calidad de estudiante activo.', 0, 2, 15000.00,
     '{"fields":[{"name":"periodo","label":"Periodo Académico","type":"text","required":true}]}', 1),

    (2, 'qt000000-0000-0000-0000-000000000002', 1, 'CERT_NOTAS',   'Certificado de Calificaciones con Promedio',
     'Historial detallado de asignaturas aprobadas y promedio acumulado.', 0, 3, 25000.00,
     '{"fields":[{"name":"incluir_porcentajes","label":"Incluir ponderaciones","type":"boolean"}]}', 1),

    (3, 'qt000000-0000-0000-0000-000000000003', 2, 'SUPLETORIO',   'Solicitud de Examen Supletorio',
     'Petición formal para presentar prueba fuera de fecha oficial por fuerza mayor.', 1, 5, 45000.00,
     '{"fields":[{"name":"asignatura","label":"Nombre de Asignatura","type":"text","required":true},{"name":"motivo","label":"Motivo justificado","type":"textarea","required":true}]}', 1),

    (4, 'qt000000-0000-0000-0000-000000000004', 2, 'HOMOLOGACION', 'Estudio de Homologación de Asignatura',
     'Reconocimiento de créditos cursados en otra institución o programa.', 1, 15, 60000.00,
     '{"fields":[{"name":"universidad_origen","label":"Universidad de Origen","type":"text","required":true}]}', 1)
ON DUPLICATE KEY UPDATE
    category_id       = VALUES(category_id),
    name              = VALUES(name),
    description       = VALUES(description),
    requires_approval = VALUES(requires_approval),
    sla_days          = VALUES(sla_days),
    cost              = VALUES(cost),
    form_schema       = VALUES(form_schema),
    is_active         = VALUES(is_active);

-- ------------------------------------------------------------
-- request_statuses
-- ------------------------------------------------------------
INSERT INTO request_statuses (id, uuid, code, name, is_terminal, color_hex, is_active)
VALUES
    (1, 'qs000000-0000-0000-0000-000000000001', 'pending',   'Radicada / Pendiente', 0, '#F59E0B', 1),
    (2, 'qs000000-0000-0000-0000-000000000002', 'in_review', 'En Revisión por Comité',0, '#3B82F6', 1),
    (3, 'qs000000-0000-0000-0000-000000000003', 'approved',  'Aprobada y Resuelta',   1, '#10B981', 1),
    (4, 'qs000000-0000-0000-0000-000000000004', 'rejected',  'Rechazada con Justificación', 1, '#EF4444', 1),
    (5, 'qs000000-0000-0000-0000-000000000005', 'closed',    'Cerrada / Archivada',   1, '#6B7280', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    is_terminal = VALUES(is_terminal),
    color_hex   = VALUES(color_hex),
    is_active   = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
