const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class ArchivoRepository {
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
    return `id, uuid, original_name AS originalName, stored_name AS storedName,
            storage_driver AS storageDriver, storage_path AS storagePath,
            mime_type AS mimeType, extension, size_bytes AS sizeBytes,
            checksum_sha256 AS checksumSha256, owner_user_uuid AS ownerUserUuid,
            owner_type AS ownerType, owner_reference_uuid AS ownerReferenceUuid,
            metadata, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  hydrate(file) {
    if (!file) return null;
    if (typeof file.metadata === 'string') {
      file.metadata = file.metadata ? JSON.parse(file.metadata) : null;
    }
    return file;
  }

  async create({
    originalName, storedName, storageDriver, storagePath, mimeType, extension,
    sizeBytes, checksumSha256, ownerUserUuid, ownerType, ownerReferenceUuid, metadata,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO files (
        uuid, original_name, stored_name, storage_driver, storage_path, mime_type,
        extension, size_bytes, checksum_sha256, owner_user_uuid, owner_type,
        owner_reference_uuid, metadata, is_active
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        originalName, storedName, storageDriver, storagePath, mimeType, extension,
        sizeBytes, checksumSha256, ownerUserUuid, ownerType ?? null,
        ownerReferenceUuid ?? null, metadata ? JSON.stringify(metadata) : null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({
    page = 1, limit = 10, ownerUserUuid, ownerType,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (ownerUserUuid) { conditions.push('owner_user_uuid = ?'); params.push(ownerUserUuid); }
    if (ownerType) { conditions.push('owner_type = ?'); params.push(ownerType); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM files ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM files ${whereClause}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return {
      data: rows.map((row) => this.hydrate(row)),
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM files WHERE id = ? AND is_active = 1`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE files SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = ArchivoRepository;
