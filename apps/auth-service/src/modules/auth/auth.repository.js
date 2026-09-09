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
}

module.exports = AuthRepository;
