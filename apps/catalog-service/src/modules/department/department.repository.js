const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class DepartmentRepository {
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

  async create({ countryId = 1, name, daneCode }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO departments (country_id, name, dane_code, is_active) VALUES (?, ?, ?, ?)',
      [countryId ?? 1, name, daneCode ?? null, 1],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM departments WHERE is_active = ?',
      [1],
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      'SELECT id, uuid, country_id AS countryId, name, dane_code AS daneCode, is_active AS active, created_at, updated_at FROM departments WHERE is_active = ? ORDER BY id DESC LIMIT ? OFFSET ?',
      [1, limit, offset],
    );

    return {
      data: rows,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT id, uuid, country_id AS countryId, name, dane_code AS daneCode, is_active AS active, created_at, updated_at FROM departments WHERE id = ? AND is_active = ?',
      [id, 1],
    );
    return rows[0] || null;
  }

  async update(id, { countryId, name, daneCode }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];

    if (name !== undefined) {
      sets.push('name = ?');
      params.push(name);
    }
    if (daneCode !== undefined) {
      sets.push('dane_code = ?');
      params.push(daneCode ?? null);
    }
    if (countryId !== undefined) {
      sets.push('country_id = ?');
      params.push(countryId);
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE departments SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE departments SET is_active = ? WHERE id = ? AND is_active = ?',
      [0, id, 1],
    );
    return result.affectedRows > 0;
  }

  async findByName(name) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT id, uuid, country_id AS countryId, name, dane_code AS daneCode, is_active AS active, created_at, updated_at FROM departments WHERE name = ? AND is_active = ?',
      [name, 1],
    );
    return rows[0] || null;
  }

  async search(term) {
    const pool = await this.getPool();
    const pattern = `%${term}%`;
    const rows = await pool.query(
      'SELECT id, uuid, country_id AS countryId, name, dane_code AS daneCode, is_active AS active, created_at, updated_at FROM departments WHERE is_active = ? AND (name LIKE ? OR dane_code LIKE ?) ORDER BY name ASC LIMIT 50',
      [1, pattern, pattern],
    );
    return rows;
  }

  async countAll() {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM departments WHERE is_active = ?',
      [1],
    );
    return rows[0].total;
  }
}

module.exports = DepartmentRepository;
