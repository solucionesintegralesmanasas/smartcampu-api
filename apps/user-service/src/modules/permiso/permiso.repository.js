const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class PermisoRepository {
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

  async create({
    name, module: moduleName, resource, action, description,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      "INSERT INTO permissions (uuid, name, guard_name, module, resource, action, description) VALUES (UUID(), ?, 'api', ?, ?, ?, ?)",
      [name, moduleName, resource, action, description ?? null],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10, module: moduleName } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    if (moduleName) {
      conditions.push('module = ?');
      params.push(moduleName);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM permissions ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT id, uuid, name, module, resource, action, description,
              created_at AS createdAt, updated_at AS updatedAt
       FROM permissions ${whereClause} ORDER BY module ASC, action ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      data: rows,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT id, uuid, name, module, resource, action, description,
              created_at AS createdAt, updated_at AS updatedAt
       FROM permissions WHERE id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  async findByName(name) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT id, uuid, name, module, resource, action, description,
              created_at AS createdAt, updated_at AS updatedAt
       FROM permissions WHERE name = ?`,
      [name],
    );
    return rows[0] || null;
  }

  async update(id, { description }) {
    const pool = await this.getPool();
    if (description !== undefined) {
      await pool.query('UPDATE permissions SET description = ? WHERE id = ?', [description, id]);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query('DELETE FROM permissions WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  async countRolesWithPermission(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM role_permissions WHERE permission_id = ?',
      [id],
    );
    return rows[0].total;
  }
}

module.exports = PermisoRepository;
