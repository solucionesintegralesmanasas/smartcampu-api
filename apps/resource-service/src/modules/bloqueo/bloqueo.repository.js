const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class BloqueoRepository {
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
    return `id, uuid, resource_id AS resourceId, starts_at AS startsAt, ends_at AS endsAt,
            reason, created_by_uuid AS createdByUuid,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    resourceId, startsAt, endsAt, reason, createdByUuid,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO resource_blackouts (resource_id, starts_at, ends_at, reason, created_by_uuid) VALUES (?, ?, ?, ?, ?)',
      [resourceId, startsAt, endsAt, reason, createdByUuid],
    );
    return this.findById(result.insertId);
  }

  async findByResourceId(resourceId) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT ${this.columns()} FROM resource_blackouts
       WHERE resource_id = ? ORDER BY starts_at DESC`,
      [resourceId],
    );
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM resource_blackouts WHERE id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  /**
   * ¿Existe algún bloqueo del recurso que se traslape con [starts, ends)?
   */
  async findOverlapping(resourceId, startsAt, endsAt) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM resource_blackouts
       WHERE resource_id = ? AND starts_at < ? AND ends_at > ?
       LIMIT 1`,
      [resourceId, endsAt, startsAt],
    );
    return rows[0] || null;
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query('DELETE FROM resource_blackouts WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = BloqueoRepository;
