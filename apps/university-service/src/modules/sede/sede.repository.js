const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class SedeRepository {
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
    return `id, uuid, name, address, phone, email,
            city_uuid AS cityUuid, city_name AS cityName, state_name AS stateName,
            is_main AS isMain, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    name, address, phone, email, cityUuid, cityName, stateName, isMain,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO campuses (
        name, address, phone, email, city_uuid, city_name, state_name, is_main, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name, address ?? null, phone ?? null, email ?? null,
        cityUuid, cityName, stateName, isMain ? 1 : 0,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) AS total FROM campuses WHERE is_active = 1', []);
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM campuses WHERE is_active = 1
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM campuses WHERE id = ? AND is_active = 1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByName(name) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM campuses WHERE name = ? AND is_active = 1`,
      [name],
    );
    return rows[0] || null;
  }

  async update(id, {
    name, address, phone, email, isMain,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (address !== undefined) { sets.push('address = ?'); params.push(address); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { sets.push('email = ?'); params.push(email); }
    if (isMain !== undefined) { sets.push('is_main = ?'); params.push(isMain ? 1 : 0); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE campuses SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE campuses SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }

  async countActiveFaculties(sedeId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM faculties WHERE campus_id = ? AND is_active = 1',
      [sedeId],
    );
    return rows[0].total;
  }
}

module.exports = SedeRepository;
