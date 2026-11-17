const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class RespuestaRepository {
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
    return `id, uuid, pqrs_id AS pqrsId, author_uuid AS authorUuid,
            author_name AS authorName, body, is_final AS isFinal, created_at AS createdAt`;
  }

  async create({
    pqrsId, authorUuid, authorName, body, isFinal,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO pqrs_responses (uuid, pqrs_id, author_uuid, author_name, body, is_final)
       VALUES (UUID(), ?, ?, ?, ?, ?)`,
      [pqrsId, authorUuid, authorName, body, isFinal === false ? 0 : 1],
    );
    return this.findById(result.insertId);
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM pqrs_responses WHERE id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  async findByPqrsId(pqrsId) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT ${this.columns()} FROM pqrs_responses
       WHERE pqrs_id = ? ORDER BY created_at ASC`,
      [pqrsId],
    );
  }
}

module.exports = RespuestaRepository;
