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
    return `id, uuid, code, name, is_terminal AS isTerminal, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({ code, name, isTerminal }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO event_statuses (code, name, is_terminal, is_active) VALUES (?, ?, ?, 1)',
      [code, name, isTerminal ? 1 : 0],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM event_statuses WHERE is_active = 1',
      [],
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM event_statuses WHERE is_active = 1
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM event_statuses WHERE id = ? AND is_active = 1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByCode(code) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM event_statuses WHERE code = ? AND is_active = 1`,
      [code],
    );
    return rows[0] || null;
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE event_statuses SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }

  async countActiveEvents(statusId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM events WHERE status_id = ? AND is_active = 1',
      [statusId],
    );
    return rows[0].total;
  }
}

module.exports = EstadoRepository;
