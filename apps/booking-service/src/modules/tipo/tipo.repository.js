const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class TipoRepository {
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
    return `id, uuid, code, name, description, requires_approval AS requiresApproval,
            max_duration_minutes AS maxDurationMinutes, advance_days_limit AS advanceDaysLimit,
            is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    code, name, description, requiresApproval, maxDurationMinutes, advanceDaysLimit,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO booking_types (
        code, name, description, requires_approval,
        max_duration_minutes, advance_days_limit, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        code, name, description ?? null, requiresApproval === false ? 0 : 1,
        maxDurationMinutes ?? null, advanceDaysLimit ?? null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM booking_types WHERE is_active = 1',
      [],
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM booking_types WHERE is_active = 1
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM booking_types WHERE id = ? AND is_active = 1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByCode(code) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM booking_types WHERE code = ? AND is_active = 1`,
      [code],
    );
    return rows[0] || null;
  }

  async update(id, {
    name, description, maxDurationMinutes, advanceDaysLimit,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (maxDurationMinutes !== undefined) { sets.push('max_duration_minutes = ?'); params.push(maxDurationMinutes); }
    if (advanceDaysLimit !== undefined) { sets.push('advance_days_limit = ?'); params.push(advanceDaysLimit); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE booking_types SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE booking_types SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }

  async countActiveBookings(typeId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM bookings WHERE booking_type_id = ? AND is_active = 1',
      [typeId],
    );
    return rows[0].total;
  }
}

module.exports = TipoRepository;
