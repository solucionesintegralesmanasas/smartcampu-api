const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class HorarioRepository {
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
    return `id, uuid, resource_id AS resourceId, day_of_week AS dayOfWeek,
            open_time AS openTime, close_time AS closeTime,
            is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    resourceId, dayOfWeek, openTime, closeTime,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO resource_schedules (resource_id, day_of_week, open_time, close_time, is_active) VALUES (?, ?, ?, ?, 1)',
      [resourceId, dayOfWeek, openTime, closeTime],
    );
    return this.findById(result.insertId);
  }

  async findByResourceId(resourceId) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT ${this.columns()} FROM resource_schedules
       WHERE resource_id = ? AND is_active = 1 ORDER BY day_of_week ASC`,
      [resourceId],
    );
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM resource_schedules WHERE id = ? AND is_active = 1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByResourceAndDay(resourceId, dayOfWeek) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM resource_schedules
       WHERE resource_id = ? AND day_of_week = ? AND is_active = 1`,
      [resourceId, dayOfWeek],
    );
    return rows[0] || null;
  }

  async update(id, { openTime, closeTime }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (openTime !== undefined) { sets.push('open_time = ?'); params.push(openTime); }
    if (closeTime !== undefined) { sets.push('close_time = ?'); params.push(closeTime); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE resource_schedules SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE resource_schedules SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = HorarioRepository;
