const mysql = require('mysql2/promise');

async function test() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'uajs_user',
    password: 'uajs206**',
  });

  const [academicPersons] = await conn.query(
    "SELECT id, uuid, document_type_code, document_number, CONCAT(first_name, ' ', last_name) as nombre, email FROM uajs_academic.persons ORDER BY id",
  );
  console.log('\n=== uajs_academic.persons (Maestro) ===');
  console.table(academicPersons);

  const [authPersons] = await conn.query(
    "SELECT id, uuid, document_type_code, document_number, CONCAT(first_name, ' ', last_name) as nombre, email FROM uajs_auth.persons ORDER BY id",
  );
  console.log('\n=== uajs_auth.persons (Snapshot Auth) ===');
  console.table(authPersons);

  const [users] = await conn.query(
    'SELECT u.id, u.uuid, u.person_id, u.email, u.is_active FROM uajs_auth.users u ORDER BY u.id',
  );
  console.log('\n=== uajs_auth.users (Usuarios) ===');
  console.table(users);

  const [students] = await conn.query(
    'SELECT s.id, s.student_code, s.person_id, s.program_id, s.user_uuid, s.current_semester, s.status FROM uajs_academic.students s ORDER BY s.id',
  );
  console.log('\n=== uajs_academic.students (Estudiantes) ===');
  console.table(students);

  const [teachers] = await conn.query(
    'SELECT t.id, t.teacher_code, t.person_id, t.faculty_id, t.user_uuid, t.contract_type, t.status FROM uajs_academic.teachers t ORDER BY t.id',
  );
  console.log('\n=== uajs_academic.teachers (Docentes) ===');
  console.table(teachers);

  const [userRoles] = await conn.query(
    "SELECT ur.user_id, u.email, r.name as rol FROM uajs_auth.user_roles ur JOIN uajs_auth.users u ON u.id = ur.user_id JOIN uajs_auth.roles r ON r.id = ur.role_id WHERE r.name NOT IN ('SUPERADMIN', 'ADMIN', 'STAFF', 'TEACHER', 'STUDENT') ORDER BY ur.user_id",
  );
  console.log('\n=== uajs_auth.user_roles (Asignación Roles Canónicos) ===');
  console.table(userRoles);

  await conn.end();
}

test();
