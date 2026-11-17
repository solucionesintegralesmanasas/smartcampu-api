-- ============================================================
-- SEEDER: uajs_auth & uajs_academic — Personas, Usuarios y Roles
-- Microservicios: ms-auth & ms-academic (university-service)
-- Descripción:
--   Siembra completa del personal institucional y cuentas de acceso
--   respetando las reglas de integridad referencial entre dominios:
--   1. Asegura la existencia de los roles de sistema en uajs_auth.roles.
--   2. Registra las personas naturales maestras en uajs_academic.persons.
--   3. Registra el snapshot de persona en uajs_auth.persons.
--   4. Registra los usuarios en uajs_auth.users vinculados por person_id.
--   5. Asigna los roles en uajs_auth.user_roles.
--   6. Si el rol es ESTUDIANTE: se registra en uajs_academic.students
--      vinculado a persona, programa académico y con user_uuid. (2 estudiantes).
--   7. Si el rol es DOCENTE: se registra en uajs_academic.teachers
--      vinculado a persona, facultad y con user_uuid. (2 profesores).
--   8. Si el rol es ADMINISTRATIVO / PERSONAL: vinculado a persona y roles (1 administrativo).
--   9. Super Administrador con acceso global.
--
-- Credencial de acceso para todos los usuarios de prueba:
--   Contraseña: Campus2026!*
--   Hash bcrypt ($2b$12$): $2b$12$AyoGehF/HjKwe4262TWFTeN4Ob.TBNAu5Kbu4fdRbG0ozRVB8wPX.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

-- ============================================================
-- 1. ASEGURAR ROLES EN uajs_auth
-- ============================================================
USE uajs_auth;

INSERT INTO roles (id, uuid, name, guard_name, description, is_system)
VALUES
    (1, 'r0000000-0000-0000-0000-000000000001', 'SUPER_ADMINISTRADOR', 'api', 'Acceso total sin restricciones al sistema UAJS.', 1),
    (2, 'r0000000-0000-0000-0000-000000000002', 'ADMINISTRADOR',       'api', 'Administrador de gestión institucional y académica.', 1),
    (3, 'r0000000-0000-0000-0000-000000000003', 'ESTUDIANTE',          'api', 'Estudiante activo matriculado en programas académicos.', 1),
    (4, 'r0000000-0000-0000-0000-000000000004', 'DOCENTE',             'api', 'Cuerpo docente y de investigación de la institución.', 1),
    (5, 'r0000000-0000-0000-0000-000000000005', 'PERSONAL',            'api', 'Personal de apoyo administrativo, admisiones y servicios.', 1),
    -- Alias en inglés para compatibilidad
    (6, 'r0000000-0000-0000-0000-000000000006', 'SUPERADMIN',           'api', 'Alias de SUPER_ADMINISTRADOR', 1),
    (7, 'r0000000-0000-0000-0000-000000000007', 'ADMIN',                'api', 'Alias de ADMINISTRADOR', 1),
    (8, 'r0000000-0000-0000-0000-000000000008', 'STUDENT',              'api', 'Alias de ESTUDIANTE', 1),
    (9, 'r0000000-0000-0000-0000-000000000009', 'TEACHER',              'api', 'Alias de DOCENTE', 1),
    (10,'r0000000-0000-0000-0000-000000000010', 'STAFF',                'api', 'Alias de PERSONAL', 1)
ON DUPLICATE KEY UPDATE
    name        = VALUES(name),
    guard_name  = VALUES(guard_name),
    description = VALUES(description),
    is_system   = VALUES(is_system);

-- ============================================================
-- 2. REGISTRAR PERSONAS EN uajs_academic (Maestro)
-- ============================================================
USE uajs_academic;

INSERT INTO persons (
    id, uuid, document_type_code, document_number, check_digit,
    first_name, middle_name, last_name, second_last_name,
    date_of_birth, gender, email, phone, address, city_name, is_active
)
VALUES
    -- 1. Super Administrador
    (1, 'e1000000-0000-0000-0000-000000000001', 'CC', '1098000001', NULL,
     'Darwin', 'Alexis', 'Montes', 'Pérez',
     '1988-05-15', 'M', 'admin@uajs.edu.co', '+57 300 1234567', 'Carrera 27 # 9-01 Oficina 301', 'Bucaramanga', 1),

    -- 2. Administrativo
    (2, 'e1000000-0000-0000-0000-000000000002', 'CC', '91987654', NULL,
     'Roberto', 'Carlos', 'Ospina', 'Restrepo',
     '1985-08-20', 'M', 'roberto.ospina@uajs.edu.co', '+57 310 9876543', 'Calle 45 # 28-15', 'Bucaramanga', 1),

    -- 3. Docente 1 (Ingeniería de Sistemas)
    (3, 'e1000000-0000-0000-0000-000000000003', 'CC', '91234567', NULL,
     'Carlos', 'Eduardo', 'Mendoza', 'Rivera',
     '1978-03-12', 'M', 'carlos.mendoza@uajs.edu.co', '+57 315 2345678', 'Carrera 35 # 52-20', 'Bucaramanga', 1),

    -- 4. Docente 2 (Ciencias de la Salud / Medicina)
    (4, 'e1000000-0000-0000-0000-000000000004', 'CC', '63456789', NULL,
     'Martha', 'Patricia', 'Rincón', 'Duarte',
     '1982-11-28', 'F', 'martha.rincon@uajs.edu.co', '+57 318 8765432', 'Calle 105 # 24-50', 'Floridablanca', 1),

    -- 5. Estudiante 1 (Ingeniería de Software)
    (5, 'e1000000-0000-0000-0000-000000000005', 'CC', '1098765432', NULL,
     'Santiago', 'Andrés', 'Morales', 'Castro',
     '2003-04-10', 'M', 'santiago.morales@uajs.edu.co', '+57 312 3456789', 'Carrera 19 # 34-12', 'Bucaramanga', 1),

    -- 6. Estudiante 2 (Medicina)
    (6, 'e1000000-0000-0000-0000-000000000006', 'CC', '1098765433', NULL,
     'Valentina', 'Sofía', 'Gómez', 'Hernández',
     '2004-09-22', 'F', 'valentina.gomez@uajs.edu.co', '+57 314 5678901', 'Calle 56 # 33-80', 'Bucaramanga', 1)
ON DUPLICATE KEY UPDATE
    first_name       = VALUES(first_name),
    middle_name      = VALUES(middle_name),
    last_name        = VALUES(last_name),
    second_last_name = VALUES(second_last_name),
    email            = VALUES(email),
    phone            = VALUES(phone),
    address          = VALUES(address),
    city_name        = VALUES(city_name),
    is_active        = VALUES(is_active);

-- ============================================================
-- 3. REGISTRAR SNAPSHOT DE PERSONAS EN uajs_auth
-- ============================================================
USE uajs_auth;

INSERT INTO persons (
    id, uuid, document_type_code, document_number, check_digit,
    first_name, middle_name, last_name, second_last_name, email, phone
)
VALUES
    (1, 'e1000000-0000-0000-0000-000000000001', 'CC', '1098000001', NULL, 'Darwin', 'Alexis', 'Montes', 'Pérez', 'admin@uajs.edu.co', '+57 300 1234567'),
    (2, 'e1000000-0000-0000-0000-000000000002', 'CC', '91987654', NULL, 'Roberto', 'Carlos', 'Ospina', 'Restrepo', 'roberto.ospina@uajs.edu.co', '+57 310 9876543'),
    (3, 'e1000000-0000-0000-0000-000000000003', 'CC', '91234567', NULL, 'Carlos', 'Eduardo', 'Mendoza', 'Rivera', 'carlos.mendoza@uajs.edu.co', '+57 315 2345678'),
    (4, 'e1000000-0000-0000-0000-000000000004', 'CC', '63456789', NULL, 'Martha', 'Patricia', 'Rincón', 'Duarte', 'martha.rincon@uajs.edu.co', '+57 318 8765432'),
    (5, 'e1000000-0000-0000-0000-000000000005', 'CC', '1098765432', NULL, 'Santiago', 'Andrés', 'Morales', 'Castro', 'santiago.morales@uajs.edu.co', '+57 312 3456789'),
    (6, 'e1000000-0000-0000-0000-000000000006', 'CC', '1098765433', NULL, 'Valentina', 'Sofía', 'Gómez', 'Hernández', 'valentina.gomez@uajs.edu.co', '+57 314 5678901')
ON DUPLICATE KEY UPDATE
    first_name       = VALUES(first_name),
    middle_name      = VALUES(middle_name),
    last_name        = VALUES(last_name),
    second_last_name = VALUES(second_last_name),
    email            = VALUES(email),
    phone            = VALUES(phone);

-- ============================================================
-- 4. REGISTRAR USUARIOS EN uajs_auth.users
-- Contraseña para todos: Campus2026!*
-- ============================================================
INSERT INTO users (
    id, uuid, person_id, email, password_hash,
    email_verified_at, is_active
)
VALUES
    -- 1. Super Administrador
    (1, 'u0000000-0000-0000-0000-000000000001', 1, 'admin@uajs.edu.co',
     '$2b$12$AyoGehF/HjKwe4262TWFTeN4Ob.TBNAu5Kbu4fdRbG0ozRVB8wPX.', NOW(), 1),

    -- 2. Administrativo
    (2, 'u0000000-0000-0000-0000-000000000002', 2, 'roberto.ospina@uajs.edu.co',
     '$2b$12$AyoGehF/HjKwe4262TWFTeN4Ob.TBNAu5Kbu4fdRbG0ozRVB8wPX.', NOW(), 1),

    -- 3. Docente 1
    (3, 'u0000000-0000-0000-0000-000000000003', 3, 'carlos.mendoza@uajs.edu.co',
     '$2b$12$AyoGehF/HjKwe4262TWFTeN4Ob.TBNAu5Kbu4fdRbG0ozRVB8wPX.', NOW(), 1),

    -- 4. Docente 2
    (4, 'u0000000-0000-0000-0000-000000000004', 4, 'martha.rincon@uajs.edu.co',
     '$2b$12$AyoGehF/HjKwe4262TWFTeN4Ob.TBNAu5Kbu4fdRbG0ozRVB8wPX.', NOW(), 1),

    -- 5. Estudiante 1
    (5, 'u0000000-0000-0000-0000-000000000005', 5, 'santiago.morales@uajs.edu.co',
     '$2b$12$AyoGehF/HjKwe4262TWFTeN4Ob.TBNAu5Kbu4fdRbG0ozRVB8wPX.', NOW(), 1),

    -- 6. Estudiante 2
    (6, 'u0000000-0000-0000-0000-000000000006', 6, 'valentina.gomez@uajs.edu.co',
     '$2b$12$AyoGehF/HjKwe4262TWFTeN4Ob.TBNAu5Kbu4fdRbG0ozRVB8wPX.', NOW(), 1)
ON DUPLICATE KEY UPDATE
    person_id         = VALUES(person_id),
    email             = VALUES(email),
    password_hash     = VALUES(password_hash),
    is_active         = VALUES(is_active);

-- ============================================================
-- 5. ASIGNAR ROLES A LOS USUARIOS (uajs_auth.user_roles)
-- ============================================================
INSERT IGNORE INTO user_roles (user_id, role_id, assigned_by, assigned_at)
VALUES
    -- Usuario 1: Super Administrador (SUPER_ADMINISTRADOR y SUPERADMIN)
    (1, 1, 1, NOW()),
    (1, 6, 1, NOW()),

    -- Usuario 2: Administrativo / Personal (ADMINISTRADOR, PERSONAL, ADMIN, STAFF)
    (2, 2, 1, NOW()),
    (2, 5, 1, NOW()),
    (2, 7, 1, NOW()),
    (2, 10, 1, NOW()),

    -- Usuario 3: Docente 1 (DOCENTE y TEACHER)
    (3, 4, 1, NOW()),
    (3, 9, 1, NOW()),

    -- Usuario 4: Docente 2 (DOCENTE y TEACHER)
    (4, 4, 1, NOW()),
    (4, 9, 1, NOW()),

    -- Usuario 5: Estudiante 1 (ESTUDIANTE y STUDENT)
    (5, 3, 1, NOW()),
    (5, 8, 1, NOW()),

    -- Usuario 6: Estudiante 2 (ESTUDIANTE y STUDENT)
    (6, 3, 1, NOW()),
    (6, 8, 1, NOW());

-- ============================================================
-- 6. VINCULAR ESTUDIANTES EN uajs_academic.students
-- Mínimo 2 estudiantes: vinculados a persona, programa y user_uuid
-- ============================================================
USE uajs_academic;

INSERT INTO students (
    id, uuid, person_id, program_id, user_uuid,
    student_code, enrollment_date, graduation_date,
    current_semester, gpa, status, is_active
)
VALUES
    -- Estudiante 1: Santiago Morales (Ingeniería de Software - Program 2)
    (1, 's0000000-0000-0000-0000-000000000001', 5, 2, 'u0000000-0000-0000-0000-000000000005',
     'EST2026-001', '2024-02-01', NULL, 4, 4.35, 'active', 1),

    -- Estudiante 2: Valentina Gómez (Medicina General - Program 3)
    (2, 's0000000-0000-0000-0000-000000000002', 6, 3, 'u0000000-0000-0000-0000-000000000006',
     'EST2026-002', '2025-02-01', NULL, 2, 4.60, 'active', 1)
ON DUPLICATE KEY UPDATE
    person_id        = VALUES(person_id),
    program_id       = VALUES(program_id),
    user_uuid        = VALUES(user_uuid),
    student_code     = VALUES(student_code),
    current_semester = VALUES(current_semester),
    gpa              = VALUES(gpa),
    status           = VALUES(status),
    is_active        = VALUES(is_active);

-- ============================================================
-- 7. VINCULAR DOCENTES / PROFESORES EN uajs_academic.teachers
-- Mínimo 2 profesores: vinculados a persona, facultad y user_uuid
-- ============================================================
INSERT INTO teachers (
    id, uuid, person_id, faculty_id, user_uuid,
    teacher_code, contract_type, hire_date, termination_date,
    academic_degree, status, is_active
)
VALUES
    -- Docente 1: Carlos Mendoza (Facultad de Ingenierías - Faculty 1)
    (1, 't0000000-0000-0000-0000-000000000001', 3, 1, 'u0000000-0000-0000-0000-000000000003',
     'DOC2026-001', 'full_time', '2018-01-15', NULL,
     'Doctor en Ingeniería de Software y Computación', 'active', 1),

    -- Docente 2: Martha Rincón (Facultad de Ciencias de la Salud - Faculty 2)
    (2, 't0000000-0000-0000-0000-000000000002', 4, 2, 'u0000000-0000-0000-0000-000000000004',
     'DOC2026-002', 'part_time', '2020-07-01', NULL,
     'Especialista en Medicina Interna y Epidemiología', 'active', 1)
ON DUPLICATE KEY UPDATE
    person_id       = VALUES(person_id),
    faculty_id      = VALUES(faculty_id),
    user_uuid       = VALUES(user_uuid),
    teacher_code    = VALUES(teacher_code),
    contract_type   = VALUES(contract_type),
    academic_degree = VALUES(academic_degree),
    status          = VALUES(status),
    is_active       = VALUES(is_active);

SET FOREIGN_KEY_CHECKS = 1;
