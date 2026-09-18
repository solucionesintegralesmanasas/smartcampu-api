const crypto = require('crypto');

const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class AuthRepository {
  constructor() {
    this.pool = null;
  }

  async getPool() {
    if (!this.pool) {
      this.pool = createMysqlPool({
        host: env.MYSQL_HOST,
        port: env.MYSQL_PORT,
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DATABASE,
        connectionLimit: 10,
      });
    }
    return this.pool;
  }

  selectUserFields() {
    return `SELECT u.id, u.uuid, u.email, u.password_hash AS password, u.is_active AS isActive,
                   COALESCE(
                     GROUP_CONCAT(r.name ORDER BY
                       FIELD(r.name, 'SUPERADMIN', 'ADMIN', 'STAFF', 'TEACHER', 'STUDENT')),
                     ''
                   ) AS roles,
                   p.document_number AS cedula,
                   TRIM(CONCAT_WS(' ', p.first_name, p.middle_name,
                       p.last_name, p.second_last_name)) AS nombre
            FROM users u
            JOIN persons p ON p.id = u.person_id
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id`;
  }

  userGroupBy() {
    return `GROUP BY u.id, u.uuid, u.email, u.password_hash, u.is_active,
                    p.document_number, p.first_name,
                    p.middle_name, p.last_name, p.second_last_name`;
  }

  hydrate(user) {
    if (!user) return null;
    if (typeof user.roles === 'string') {
      user.roles = user.roles ? user.roles.split(',') : [];
    }
    return user;
  }

  async findByEmail(email) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `${this.selectUserFields()}
       WHERE u.email = ? AND u.deleted_at IS NULL AND u.is_active = 1
       ${this.userGroupBy()}`,
      [email],
    );
    return this.hydrate(rows[0]);
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `${this.selectUserFields()}
       WHERE u.id = ? AND u.deleted_at IS NULL AND u.is_active = 1
       ${this.userGroupBy()}`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async findPermissions(roles) {
    const pool = await this.getPool();
    if (!roles || !roles.length) return [];
    const rows = await pool.query(
      `SELECT DISTINCT p.module, p.action
       FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE r.name IN (?)
       ORDER BY p.module ASC, p.action ASC`,
      [roles],
    );
    return rows;
  }

  async create(userData) {
    const pool = await this.getPool();
    const conn = await pool.beginTransaction();
    try {
      const [personResult] = await conn.query(
        `INSERT INTO persons (
          uuid, document_type_code, document_number, check_digit, first_name,
          middle_name, last_name, second_last_name, email, phone
        )
         VALUES (UUID(), ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
        [
          userData.documentTypeCode,
          userData.documentNumber,
          userData.firstName,
          userData.middleName || null,
          userData.lastName,
          userData.secondLastName || null,
          userData.email,
        ],
      );

      const [userResult] = await conn.query(
        `INSERT INTO users (uuid, person_id, email, password_hash, email_verified_at, is_active)
         VALUES (UUID(), ?, ?, ?, NULL, 1)`,
        [personResult.insertId, userData.email, userData.password],
      );

      const roleNames = userData.roles && userData.roles.length ? userData.roles : ['STUDENT'];
      const [roleRows] = await conn.query('SELECT id FROM roles WHERE name IN (?)', [roleNames]);
      if (roleRows.length) {
        const values = roleRows.flatMap((role) => [userResult.insertId, role.id]);
        const placeholders = roleRows.map(() => '(?, ?, NULL, NOW(), NULL)').join(', ');
        await conn.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at, expires_at)
           VALUES ${placeholders}`,
          values,
        );
      }

      await conn.commit();
      return this.findById(userResult.insertId);
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async updateRefreshToken(userId, refreshToken, deviceInfo = null, ipAddress = null) {
    const pool = await this.getPool();
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const payload = JSON.parse(
      Buffer.from(refreshToken.split('.')[1], 'base64url').toString('utf8'),
    );
    const expiresAt = new Date(payload.exp * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (
        uuid, user_id, token_hash, family_id,
        device_info, ip_address, issued_at, expires_at
      )
       VALUES (UUID(), ?, ?, UUID(), ?, ?, NOW(), ?)`,
      [userId, tokenHash, deviceInfo, ipAddress, expiresAt],
    );
  }

  async findByRefreshToken(refreshToken) {
    const pool = await this.getPool();
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const rows = await pool.query(
      `${this.selectUserFields()}
       JOIN refresh_tokens rt ON rt.user_id = u.id
       WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND u.deleted_at IS NULL
             AND u.is_active = 1
       ${this.userGroupBy()}`,
      [tokenHash],
    );
    return this.hydrate(rows[0]);
  }

  async invalidateRefreshTokens(userId, reason = 'logout') {
    const pool = await this.getPool();
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = NOW(), revoke_reason = ? WHERE user_id = ? AND revoked_at IS NULL',
      [reason, userId],
    );
  }

  async createPasswordResetToken(userId, tokenHash, expiresAt) {
    const pool = await this.getPool();
    const rows = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);
    if (!rows[0]) return;
    await pool.query(
      'INSERT INTO password_reset_tokens (email, token_hash, expires_at) VALUES (?, ?, ?)',
      [rows[0].email, tokenHash, expiresAt],
    );
  }

  async findPasswordResetToken(tokenHash) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT prt.email, prt.expires_at AS expiresAt, u.id AS userId
       FROM password_reset_tokens prt
       JOIN users u ON u.email = prt.email
       WHERE prt.token_hash = ? AND prt.expires_at > NOW() AND prt.used_at IS NULL`,
      [tokenHash],
    );
    return rows[0] || null;
  }

  async deletePasswordResetToken(tokenHash) {
    const pool = await this.getPool();
    await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);
  }

  async updatePassword(userId, password) {
    const pool = await this.getPool();
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password, userId]);
  }

  /**
   * Perfil completo del usuario en UNA sola consulta: usuario de `uajs_auth`
   * + tercero (`uajs_academic.persons`) + estudiante y programa o docente y
   * facultad (`uajs_academic`). Regla del dominio: todo estudiante/docente
   * proviene de un tercero vinculado por `user_uuid` (o por email/persona).
   */
  async findFullProfile(userId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT u.id, u.uuid, u.email,
              roles_por_usuario.roles,
              pa.document_number AS cedula,
              TRIM(CONCAT_WS(' ', pa.first_name, pa.middle_name,
                  pa.last_name, pa.second_last_name)) AS nombre,
              pt.id AS tercero_id, pt.uuid AS tercero_uuid,
              pt.document_type_code AS tercero_tipoDocumento,
              pt.document_number AS tercero_numeroDocumento,
              pt.first_name AS tercero_primerNombre,
              pt.middle_name AS tercero_segundoNombre,
              pt.last_name AS tercero_primerApellido,
              pt.second_last_name AS tercero_segundoApellido,
              TRIM(CONCAT_WS(' ', pt.first_name, pt.middle_name,
                  pt.last_name, pt.second_last_name)) AS tercero_nombre,
              pt.date_of_birth AS tercero_fechaNacimiento,
              pt.gender AS tercero_genero, pt.email AS tercero_email,
              pt.phone AS tercero_telefono, pt.address AS tercero_direccion,
              pt.city_name AS tercero_ciudad,
              s.id AS estudiante_id, s.uuid AS estudiante_uuid,
              s.student_code AS estudiante_codigo,
              s.enrollment_date AS estudiante_fechaMatricula,
              s.current_semester AS estudiante_semestre,
              s.gpa AS estudiante_promedio, s.status AS estudiante_estado,
              pr.id AS programa_id, pr.name AS programa_nombre,
              pr.code AS programa_codigo,
              t.id AS docente_id, t.uuid AS docente_uuid,
              t.teacher_code AS docente_codigo,
              t.contract_type AS docente_contrato,
              t.hire_date AS docente_fechaContratacion,
              t.academic_degree AS docente_titulo,
              t.status AS docente_estado,
              f.id AS facultad_id, f.name AS facultad_nombre,
              f.code AS facultad_codigo
       FROM users u
       JOIN persons pa ON pa.id = u.person_id
       LEFT JOIN (
         SELECT ur.user_id,
                GROUP_CONCAT(r.name ORDER BY
                  FIELD(r.name, 'SUPERADMIN', 'ADMIN', 'STAFF', 'TEACHER', 'STUDENT')) AS roles
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         GROUP BY ur.user_id
       ) roles_por_usuario ON roles_por_usuario.user_id = u.id
       LEFT JOIN uajs_academic.persons pt
         ON pt.email = u.email AND pt.deleted_at IS NULL AND pt.is_active = 1
       LEFT JOIN uajs_academic.students s
         ON (s.user_uuid = u.uuid OR s.person_id = pt.id)
            AND s.deleted_at IS NULL AND s.is_active = 1
       LEFT JOIN uajs_academic.programs pr ON pr.id = s.program_id
       LEFT JOIN uajs_academic.teachers t
         ON (t.user_uuid = u.uuid OR t.person_id = pt.id)
            AND t.deleted_at IS NULL AND t.is_active = 1
       LEFT JOIN uajs_academic.faculties f ON f.id = t.faculty_id
       WHERE u.id = ? AND u.deleted_at IS NULL AND u.is_active = 1
       LIMIT 1`,
      [userId],
    );
    return this.hydrateFullProfile(rows[0]);
  }

  hydrateFullProfile(row) {
    if (!row) return null;
    const { roles: rolesRaw } = row;
    let roles = [];
    if (typeof rolesRaw === 'string' && rolesRaw) {
      roles = rolesRaw.split(',');
    } else if (Array.isArray(rolesRaw)) {
      roles = rolesRaw;
    }
    const perfil = {
      id: row.id,
      uuid: row.uuid,
      email: row.email,
      roles,
      cedula: row.cedula || null,
      nombre: row.nombre || null,
      tercero: null,
      estudiante: null,
      docente: null,
    };
    if (row.tercero_id) {
      perfil.tercero = {
        id: row.tercero_id,
        uuid: row.tercero_uuid,
        tipoDocumento: row.tercero_tipoDocumento,
        numeroDocumento: row.tercero_numeroDocumento,
        primerNombre: row.tercero_primerNombre,
        segundoNombre: row.tercero_segundoNombre,
        primerApellido: row.tercero_primerApellido,
        segundoApellido: row.tercero_segundoApellido,
        nombre: row.tercero_nombre,
        fechaNacimiento: row.tercero_fechaNacimiento,
        genero: row.tercero_genero,
        email: row.tercero_email,
        telefono: row.tercero_telefono,
        direccion: row.tercero_direccion,
        ciudad: row.tercero_ciudad,
      };
    }
    if (row.estudiante_id) {
      perfil.estudiante = {
        id: row.estudiante_id,
        uuid: row.estudiante_uuid,
        codigoEstudiante: row.estudiante_codigo,
        fechaMatricula: row.estudiante_fechaMatricula,
        semestreActual: row.estudiante_semestre,
        promedio: row.estudiante_promedio,
        estado: row.estudiante_estado,
        programa: row.programa_id
          ? { id: row.programa_id, nombre: row.programa_nombre, codigo: row.programa_codigo }
          : null,
      };
    }
    if (row.docente_id) {
      perfil.docente = {
        id: row.docente_id,
        uuid: row.docente_uuid,
        codigoDocente: row.docente_codigo,
        tipoContrato: row.docente_contrato,
        fechaContratacion: row.docente_fechaContratacion,
        tituloAcademico: row.docente_titulo,
        estado: row.docente_estado,
        facultad: row.facultad_id
          ? { id: row.facultad_id, nombre: row.facultad_nombre, codigo: row.facultad_codigo }
          : null,
      };
    }
    return perfil;
  }

  /**
   * Perfil académico del usuario desde `uajs_academic` (university-service).
   * Regla del dominio: todo usuario con rol STUDENT/TEACHER proviene de un
   * tercero (persons) vinculado vía `students.user_uuid` o
   * `teachers.user_uuid` (con respaldo por email del tercero).
   * Es best-effort: si la BD académica no está disponible, devuelve null.
   */
}

module.exports = AuthRepository;
