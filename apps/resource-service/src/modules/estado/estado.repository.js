const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class EstadoRepository {
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

  columns() {
    return `id, uuid, code, name, is_bookable AS isBookable, color_hex AS colorHex,
            is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    code, name, isBookable, colorHex,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO resource_statuses (code, name, is_bookable, color_hex, is_active) VALUES (?, ?, ?, ?, 1)',
      [code, name, isBookable === false ? 0 : 1, colorHex ?? null],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM resource_statuses WHERE is_active = 1',
      [],
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM resource_statuses WHERE is_active = 1
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM resource_statuses WHERE id = ? AND is_active = 1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByCode(code) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM resource_statuses WHERE code = ? AND is_active = 1`,
      [code],
    );
    return rows[0] || null;
  }

  async update(id, { name, isBookable, colorHex }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (isBookable !== undefined) { sets.push('is_bookable = ?'); params.push(isBookable ? 1 : 0); }
    if (colorHex !== undefined) { sets.push('color_hex = ?'); params.push(colorHex); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE resource_statuses SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE resource_statuses SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }

  async countActiveResources(statusId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM resources WHERE status_id = ? AND is_active = 1',
      [statusId],
    );
    return rows[0].total;
  }
}

module.exports = EstadoRepository;
