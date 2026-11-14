const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const SELECT_FIELDS = `id, uuid, country_id AS countryId, name, dane_code AS daneCode,
  is_active AS active, created_at, updated_at`;

const UPDATABLE_COLUMNS = {
  countryId: 'country_id',
  name: 'name',
  daneCode: 'dane_code',
};

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

  async create({ countryId, name, daneCode }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO departments (country_id, name, dane_code, is_active) VALUES (?, ?, ?, ?)',
      [countryId, name, daneCode ?? null, 1],
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
      `SELECT ${SELECT_FIELDS} FROM departments WHERE is_active = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
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
      `SELECT ${SELECT_FIELDS} FROM departments WHERE id = ? AND is_active = ?`,
      [id, 1],
    );
    return rows[0] || null;
  }

  async findByNameAndCountry(name, countryId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM departments WHERE name = ? AND country_id = ? AND is_active = ?`,
      [name, countryId, 1],
    );
    return rows[0] || null;
  }

  async update(id, dto) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];

    Object.entries(UPDATABLE_COLUMNS).forEach(([key, column]) => {
      if (dto[key] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(dto[key] ?? null);
      }
    });

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

  async search(term) {
    const pool = await this.getPool();
    const pattern = `%${term}%`;
    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM departments
       WHERE is_active = ? AND (name LIKE ? OR dane_code LIKE ?)
       ORDER BY name ASC LIMIT 50`,
      [1, pattern, pattern],
    );
    return rows;
  }
}

module.exports = DepartmentRepository;
