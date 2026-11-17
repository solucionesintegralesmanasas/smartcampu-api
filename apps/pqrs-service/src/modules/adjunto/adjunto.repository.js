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
    return `id, uuid, pqrs_id AS pqrsId, uploader_uuid AS uploaderUuid,
            file_uuid AS fileUuid, original_name AS originalName, mime_type AS mimeType,
            size_bytes AS sizeBytes, uploaded_at AS uploadedAt`;
  }

  async create({
    pqrsId, uploaderUuid, fileUuid, originalName, mimeType, sizeBytes,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO pqrs_attachments (
        uuid, pqrs_id, uploader_uuid, file_uuid, original_name, mime_type, size_bytes
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
      [pqrsId, uploaderUuid ?? null, fileUuid, originalName, mimeType, sizeBytes],
    );
    return this.findById(result.insertId);
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM pqrs_attachments WHERE id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  async findByPqrsId(pqrsId) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT ${this.columns()} FROM pqrs_attachments
       WHERE pqrs_id = ? ORDER BY uploaded_at DESC`,
      [pqrsId],
    );
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query('DELETE FROM pqrs_attachments WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = AdjuntoRepository;
