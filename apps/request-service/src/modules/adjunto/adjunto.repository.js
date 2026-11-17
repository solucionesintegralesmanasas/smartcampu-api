const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class AdjuntoRepository {
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
    return `id, uuid, request_id AS requestId, uploader_uuid AS uploaderUuid,
            file_uuid AS fileUuid, original_name AS originalName, mime_type AS mimeType,
            size_bytes AS sizeBytes, uploaded_at AS uploadedAt`;
  }

  async create({
    requestId, uploaderUuid, fileUuid, originalName, mimeType, sizeBytes,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO request_attachments (
        uuid, request_id, uploader_uuid, file_uuid, original_name, mime_type, size_bytes
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
      [requestId, uploaderUuid, fileUuid, originalName, mimeType, sizeBytes],
    );
    return this.findById(result.insertId);
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM request_attachments WHERE id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  async findByRequestId(requestId) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT ${this.columns()} FROM request_attachments
       WHERE request_id = ? ORDER BY uploaded_at DESC`,
      [requestId],
    );
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query('DELETE FROM request_attachments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = AdjuntoRepository;
