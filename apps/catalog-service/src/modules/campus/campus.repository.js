const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class CampusRepository {
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
    cityId, name, address, phone,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO campuses (name, address, phone, city_id, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, address ?? null, phone ?? null, cityId, 1],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM campuses WHERE is_active = ?',
      [1],
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      'SELECT id, uuid, name, address, phone, city_id AS cityId, is_active AS active, created_at, updated_at FROM campuses WHERE is_active = ? ORDER BY id DESC LIMIT ? OFFSET ?',
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
      'SELECT id, uuid, name, address, phone, city_id AS cityId, is_active AS active, created_at, updated_at FROM campuses WHERE id = ? AND is_active = ?',
      [id, 1],
    );
    return rows[0] || null;
  }

  async findByCityId(cityId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT id, uuid, name, address, phone, city_id AS cityId, is_active AS active, created_at, updated_at FROM campuses WHERE city_id = ? AND is_active = ? ORDER BY name',
      [cityId, 1],
    );
    return rows;
  }

  async findByName(name) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT id, uuid, name, address, phone, city_id AS cityId, is_active AS active, created_at, updated_at FROM campuses WHERE name = ? AND is_active = ?',
      [name, 1],
    );
    return rows[0] || null;
  }

  async update(id, {
    cityId, name, address, phone,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];

    if (name !== undefined) {
      sets.push('name = ?');
      params.push(name);
    }
    if (address !== undefined) {
      sets.push('address = ?');
      params.push(address ?? null);
    }
    if (phone !== undefined) {
      sets.push('phone = ?');
      params.push(phone ?? null);
    }
    if (cityId !== undefined) {
      sets.push('city_id = ?');
      params.push(cityId);
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE campuses SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE campuses SET is_active = ? WHERE id = ? AND is_active = ?',
      [0, id, 1],
    );
    return result.affectedRows > 0;
  }

  async search(term) {
    const pool = await this.getPool();
    const pattern = `%${term}%`;
    const rows = await pool.query(
      'SELECT id, uuid, name, address, phone, city_id AS cityId, is_active AS active, created_at, updated_at FROM campuses WHERE is_active = ? AND (name LIKE ? OR address LIKE ? OR phone LIKE ?) ORDER BY name ASC LIMIT 50',
      [1, pattern, pattern, pattern],
    );
    return rows;
  }

  async countAll() {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM campuses WHERE is_active = ?',
      [1],
    );
    return rows[0].total;
  }
}

module.exports = CampusRepository;
