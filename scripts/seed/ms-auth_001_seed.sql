-- ============================================================
-- SEEDER: uajs_auth — Roles, permisos y RBAC base
-- Microservicio: ms-auth
-- Descripción: Población del RBAC base (roles y permisos) del
--              servicio de autenticación.
-- NOTA IMPORTANTE: NO se siembran personas ni usuarios ficticios.
-- La primera cuenta (persona + usuario) debe registrarse con datos
-- reales a través del flujo de registro del servicio auth-service.
-- Ejecución:  mysql -h 127.0.0.1 -P 3307 -uroot -proot < ms-auth_001_seed.sql
-- Idempotente: seguro de re-ejecutar (INSERT ... ON DUPLICATE KEY UPDATE
--              + INSERT IGNORE en las relaciones).
-- ============================================================

CREATE DATABASE IF NOT EXISTS uajs_auth
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE uajs_auth;

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ------------------------------------------------------------
-- roles (catálogo de roles RBAC)
-- ------------------------------------------------------------
INSERT INTO roles (id, uuid, name, guard_name, description, is_system)
VALUES
    (1, UUID(), 'SUPERADMIN', 'api', 'Acceso total al sistema. Rol de sistema no eliminable.', 1),
    (2, UUID(), 'ADMIN',      'api', 'Administrador general de la plataforma.', 1),
    (3, UUID(), 'STUDENT',    'api', 'Estudiante de la institución.', 1),
    (4, UUID(), 'TEACHER',    'api', 'Docente de la institución.', 1),
    (5, UUID(), 'STAFF',      'api', 'Personal administrativo.', 1)
ON DUPLICATE KEY UPDATE
    guard_name  = VALUES(guard_name),
    description = VALUES(description),
    is_system   = VALUES(is_system);

-- ------------------------------------------------------------
-- permissions (convención: <modulo>.<recurso>.<accion>)
-- ------------------------------------------------------------
INSERT INTO permissions (id, uuid, name, guard_name, module, resource, action, description)
VALUES
    -- catalog
    (1,   UUID(), 'catalog.countries.read',   'api', 'catalog',   'countries',      'read',   'Leer países'),
    (2,   UUID(), 'catalog.departments.read', 'api', 'catalog',   'departments',            'read',   'Leer departamentos'),
    (3,   UUID(), 'catalog.cities.read',      'api', 'catalog',   'cities',         'read',   'Leer ciudades'),
    (4,   UUID(), 'catalog.document_types.read', 'api', 'catalog', 'document_types', 'read',  'Leer tipos de documento'),
    (5,   UUID(), 'catalog.countries.write',  'api', 'catalog',   'countries',      'write',  'Crear/editar países'),
    (6,   UUID(), 'catalog.departments.write', 'api', 'catalog',  'departments',            'write',  'Crear/editar departamentos'),
    (7,   UUID(), 'catalog.cities.write',     'api', 'catalog',   'cities',         'write',  'Crear/editar ciudades'),
    (8,   UUID(), 'catalog.document_types.write', 'api', 'catalog', 'document_types', 'write', 'Crear/editar tipos de documento'),
    -- auth
    (9,   UUID(), 'auth.users.read',          'api', 'auth',      'users',          'read',   'Leer usuarios'),
    (10,  UUID(), 'auth.users.write',         'api', 'auth',      'users',          'write',  'Crear/editar usuarios'),
    (11,  UUID(), 'auth.roles.read',          'api', 'auth',      'roles',          'read',   'Leer roles'),
    (12,  UUID(), 'auth.roles.write',         'api', 'auth',      'roles',          'write',  'Crear/editar roles'),
    (13,  UUID(), 'auth.permissions.read',    'api', 'auth',      'permissions',    'read',   'Leer permisos'),
    (14,  UUID(), 'auth.permissions.write',   'api', 'auth',      'permissions',    'write',  'Crear/editar permisos'),
    -- academic
    (15,  UUID(), 'academic.students.read',   'api', 'academic',  'students',       'read',   'Leer estudiantes'),
    (16,  UUID(), 'academic.students.write',  'api', 'academic',  'students',       'write',  'Crear/editar estudiantes'),
    (17,  UUID(), 'academic.teachers.read',   'api', 'academic',  'teachers',       'read',   'Leer docentes'),
    (18,  UUID(), 'academic.teachers.write',  'api', 'academic',  'teachers',       'write',  'Crear/editar docentes'),
    -- bookings
    (19,  UUID(), 'bookings.bookings.read',   'api', 'bookings',  'bookings',       'read',   'Leer reservas'),
    (20,  UUID(), 'bookings.bookings.write',  'api', 'bookings',  'bookings',       'write',  'Crear/editar reservas'),
    (21,  UUID(), 'bookings.rooms.read',      'api', 'bookings',  'rooms',          'read',   'Leer salas'),
    (22,  UUID(), 'bookings.rooms.approve',   'api', 'bookings',  'rooms',          'approve','Aprobar reservas de salas')
ON DUPLICATE KEY UPDATE
    guard_name  = VALUES(guard_name),
    module      = VALUES(module),
    resource    = VALUES(resource),
    action      = VALUES(action),
    description = VALUES(description);

-- ------------------------------------------------------------
-- role_permissions — SUPERADMIN tiene TODOS los permisos
-- (todas las combinaciones rol ↔ permiso para el rol SUPERADMIN)
-- ------------------------------------------------------------
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

SET FOREIGN_KEY_CHECKS = 1;