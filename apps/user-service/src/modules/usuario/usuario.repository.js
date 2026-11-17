const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class UsuarioRepository {
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
    return `SELECT u.id, u.uuid, u.email, u.is_active AS isActive,
                   u.created_at AS createdAt, u.updated_at AS updatedAt,
                   p.document_type_code AS documentTypeCode,
                   p.document_number AS documentNumber,
                   p.phone AS telefono,
                   TRIM(CONCAT_WS(' ', p.first_name, p.middle_name,
                       p.last_name, p.second_last_name)) AS nombre,
                   COALESCE(
                     GROUP_CONCAT(DISTINCT r.name ORDER BY r.name),
                     ''
                   ) AS roles
            FROM users u
            LEFT JOIN persons p ON p.id = u.person_id
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id`;
  }

  userGroupBy() {
    return `GROUP BY u.id, u.uuid, u.email, u.is_active, u.created_at, u.updated_at,
                    p.document_type_code, p.document_number, p.phone,
                    p.first_name, p.middle_name, p.last_name, p.second_last_name`;
  }

  hydrate(user) {
    if (!user) return null;
    if (typeof user.roles === 'string') {
      user.roles = user.roles ? user.roles.split(',') : [];
    }
    return user;
  }

  async findAll({
    page = 1, limit = 10, isActive, role,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['u.deleted_at IS NULL'];
    const params = [];

    if (isActive !== undefined) {
      conditions.push('u.is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (role) {
      conditions.push('r.name = ?');
      params.push(role);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const rows = await pool.query(
      `${this.selectUserFields()}
       ${whereClause}
       ${this.userGroupBy()}
       ORDER BY u.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const countRows = await pool.query(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       ${whereClause}`,
      params,
    );

    return {
      data: rows.map((row) => this.hydrate(row)),
      pagination: getPaginationMeta(page, limit, countRows[0].total),
    };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `${this.selectUserFields()}
       WHERE u.id = ? AND u.deleted_at IS NULL
       ${this.userGroupBy()}`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async update(id, {
    firstName, middleName, lastName, secondLastName, phone, isActive,
  }) {
    const pool = await this.getPool();
    const user = await this.findById(id);
    if (!user) return null;

    const personSets = [];
    const personParams = [];
    if (firstName !== undefined) { personSets.push('first_name = ?'); personParams.push(firstName); }
    if (middleName !== undefined) { personSets.push('middle_name = ?'); personParams.push(middleName); }
    if (lastName !== undefined) { personSets.push('last_name = ?'); personParams.push(lastName); }
    if (secondLastName !== undefined) {
      personSets.push('second_last_name = ?');
      personParams.push(secondLastName);
    }
    if (phone !== undefined) { personSets.push('phone = ?'); personParams.push(phone); }

    if (personSets.length > 0) {
      await pool.query(
        `UPDATE persons p JOIN users u ON u.person_id = p.id
         SET ${personSets.join(', ')} WHERE u.id = ?`,
        [...personParams, id],
      );
    }

    if (isActive !== undefined) {
      await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
    }

    return this.findById(id);
  }

  async deactivate(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE users SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }

  async findRoleIdsByName(roleNames) {
    const pool = await this.getPool();
    const rows = await pool.query('SELECT id, name FROM roles WHERE name IN (?)', [roleNames]);
    return rows;
  }

  async replaceRoles(id, roleNames, assignedBy) {
    const pool = await this.getPool();
    const conn = await pool.beginTransaction();
    try {
      const [roleRows] = await conn.query('SELECT id FROM roles WHERE name IN (?)', [roleNames]);
      await conn.query('DELETE FROM user_roles WHERE user_id = ?', [id]);
      if (roleRows.length) {
        const values = roleRows.flatMap((role) => [id, role.id, assignedBy || null]);
        const placeholders = roleRows.map(() => '(?, ?, ?, NOW(), NULL)').join(', ');
        await conn.query(
          `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at, expires_at)
           VALUES ${placeholders}`,
          values,
        );
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
    return this.findById(id);
  }
}

module.exports = UsuarioRepository;
