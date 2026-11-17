const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class ComentarioRepository {
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
    return `id, uuid, request_id AS requestId, author_uuid AS authorUuid,
            author_name AS authorName, body, is_internal AS isInternal,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    requestId, authorUuid, authorName, body, isInternal,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO request_comments (uuid, request_id, author_uuid, author_name, body, is_internal)
       VALUES (UUID(), ?, ?, ?, ?, ?)`,
      [requestId, authorUuid, authorName, body, isInternal ? 1 : 0],
    );
    return this.findById(result.insertId);
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM request_comments WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] || null;
  }

  async findByRequestId(requestId, { includeInternal = true } = {}) {
    const pool = await this.getPool();
    const conditions = ['request_id = ?', 'deleted_at IS NULL'];
    const params = [requestId];
    if (!includeInternal) {
      conditions.push('is_internal = 0');
    }
    return pool.query(
      `SELECT ${this.columns()} FROM request_comments
       WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC`,
      params,
    );
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE request_comments SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = ComentarioRepository;
