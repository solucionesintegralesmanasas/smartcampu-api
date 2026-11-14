const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const SELECT_FIELDS = `id, uuid, name, dane_code AS daneCode, state_id AS stateId,
  is_active AS active, created_at, updated_at`;

const UPDATABLE_COLUMNS = {
  stateId: 'state_id',
  name: 'name',
  daneCode: 'dane_code',
};

class CityRepository {
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

  async create({ stateId, name, daneCode }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO cities (state_id, name, dane_code, is_active) VALUES (?, ?, ?, ?)',
      [stateId, name, daneCode ?? null, 1],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM cities WHERE is_active = ?',
      [1],
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM cities WHERE is_active = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
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
      `SELECT ${SELECT_FIELDS} FROM cities WHERE id = ? AND is_active = ?`,
      [id, 1],
    );
    return rows[0] || null;
  }

  async findByStateId(stateId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM cities WHERE state_id = ? AND is_active = ? ORDER BY name`,
      [stateId, 1],
    );
    return rows;
  }

  async findByNameAndState(name, stateId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM cities WHERE name = ? AND state_id = ? AND is_active = ?`,
      [name, stateId, 1],
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
      await pool.query(`UPDATE cities SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE cities SET is_active = ? WHERE id = ? AND is_active = ?',
      [0, id, 1],
    );
    return result.affectedRows > 0;
  }

  async search(term) {
    const pool = await this.getPool();
    const pattern = `%${term}%`;
    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM cities
       WHERE is_active = ? AND (name LIKE ? OR dane_code LIKE ?)
       ORDER BY name ASC LIMIT 50`,
      [1, pattern, pattern],
    );
    return rows;
  }
}

module.exports = CityRepository;
