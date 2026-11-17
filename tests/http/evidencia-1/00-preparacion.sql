-- ============================================================================
-- EVIDENCIA 1 · VERIFICACIÓN SQL DE 00-preparacion.http
-- ----------------------------------------------------------------------------
-- Conexión: 127.0.0.1:3307 · uajs_user / uajs206**  (DBeaver / HeidiSQL)
-- Ejecutar después de PRE-03 (login) y PRE-04 (perfil) del .http.
-- Cada bloque indica el caso del plan que verifica.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- CP-INF-01 · Bases de datos presentes (11 filas esperadas)
-- ----------------------------------------------------------------------------
SHOW DATABASES LIKE 'uajs\_%';


-- ----------------------------------------------------------------------------
-- CP-INF-03 · Roles semilla cargados (esperado: 5)
-- ----------------------------------------------------------------------------
SELECT COUNT(*) AS total_roles FROM uajs_auth.roles;


-- ----------------------------------------------------------------------------
-- CP-AUT-04 · La cuenta del administrador existe, está activa y no bloqueada
-- Esperado: 1 fila, is_active = 1, locked_until NULL, failed_attempts = 0
-- (tras un login correcto, failed_attempts vuelve a 0)
-- ----------------------------------------------------------------------------
SELECT id, uuid, email, is_active, failed_attempts, locked_until, last_login_at
  FROM uajs_auth.users
 WHERE email = 'evidencia.qa@uajs.edu';


-- ----------------------------------------------------------------------------
-- CP-AUT-04 · El login de PRE-03 actualizó last_login_at (comparar con la hora de la prueba)
-- Esperado: last_login_at dentro de los últimos minutos
-- ----------------------------------------------------------------------------
SELECT email, last_login_at,
       TIMESTAMPDIFF(MINUTE, last_login_at, NOW()) AS minutos_desde_login
  FROM uajs_auth.users
 WHERE email = 'evidencia.qa@uajs.edu';


-- ----------------------------------------------------------------------------
-- PRE-04 · Perfil del administrador: datos de la persona asociada al usuario
-- Esperado: 1 fila con nombre, apellido y documento (anotar el documento real del administrador)
-- ----------------------------------------------------------------------------
SELECT u.id              AS user_id,
       u.email,
       p.document_type_code,
       p.document_number,
       p.first_name,
       p.last_name
  FROM uajs_auth.users u
  LEFT JOIN uajs_auth.persons p ON p.id = u.person_id
 WHERE u.email = 'evidencia.qa@uajs.edu';


-- ----------------------------------------------------------------------------
-- PRE-04 · Rol SUPERADMIN asignado (requisito del .http: la ruta de usuarios lo exige)
-- Esperado: al menos una fila con rol SUPERADMIN
-- ----------------------------------------------------------------------------
SELECT u.email, r.id AS role_id, r.name AS rol
  FROM uajs_auth.users u
  JOIN uajs_auth.user_roles ur ON ur.user_id = u.id
  JOIN uajs_auth.roles r       ON r.id = ur.role_id
 WHERE u.email = 'evidencia.qa@uajs.edu';


-- ----------------------------------------------------------------------------
-- PRE-04 · Diagnóstico si el perfil responde 401/403:
-- roles activos del usuario y estado del token (no se guarda el token, solo se verifica la cuenta)
-- Esperado si todo está bien: is_active = 1 y deleted_at NULL
-- ----------------------------------------------------------------------------
SELECT u.id, u.email, u.is_active, u.deleted_at
  FROM uajs_auth.users u
 WHERE u.email = 'evidencia.qa@uajs.edu'
   AND (u.is_active = 0 OR u.deleted_at IS NOT NULL OR u.locked_until > NOW());
-- Esperado: 0 filas. Si devuelve filas, la cuenta está inactiva, borrada o bloqueada.
