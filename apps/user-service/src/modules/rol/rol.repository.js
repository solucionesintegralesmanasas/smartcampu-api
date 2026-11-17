const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class RolRepository {
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

  async create({ name, description }) {
    const pool = await this.getPool();
    const result = await pool.query(
      "INSERT INTO roles (uuid, name, guard_name, description, is_system) VALUES (UUID(), ?, 'api', ?, 0)",
      [name, description ?? null],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) AS total FROM roles', []);
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT id, uuid, name, description, is_system AS isSystem,
              created_at AS createdAt, updated_at AS updatedAt
       FROM roles ORDER BY id ASC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    return {
      data: rows,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT id, uuid, name, description, is_system AS isSystem,
              created_at AS createdAt, updated_at AS updatedAt
       FROM roles WHERE id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  async findByName(name) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT id, uuid, name, description, is_system AS isSystem,
              created_at AS createdAt, updated_at AS updatedAt
       FROM roles WHERE name = ?`,
      [name],
    );
    return rows[0] || null;
  }

  async update(id, { name, description }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];

    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query('DELETE FROM roles WHERE id = ? AND is_system = 0', [id]);
    return result.affectedRows > 0;
  }

  async countUsersWithRole(id) {
    const pool = await this.getPool();
    const rows = await pool.query('SELECT COUNT(*) AS total FROM user_roles WHERE role_id = ?', [id]);
    return rows[0].total;
  }

  async listPermissions(roleId) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT p.id, p.uuid, p.name, p.module, p.resource, p.action, p.description
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.module ASC, p.action ASC`,
      [roleId],
    );
  }

  async assignPermission(roleId, permissionId) {
    const pool = await this.getPool();
    await pool.query(
      'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
      [roleId, permissionId],
    );
  }

  async revokePermission(roleId, permissionId) {
    const pool = await this.getPool();
    const result = await pool.query(
      'DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?',
      [roleId, permissionId],
    );
    return result.affectedRows > 0;
  }
}

module.exports = RolRepository;
