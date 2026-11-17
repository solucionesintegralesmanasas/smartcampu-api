const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class SuscripcionRepository {
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
    return `id, uuid, user_uuid AS userUuid, endpoint, auth_key AS authKey,
            p256dh_key AS p256dhKey, device_type AS deviceType, device_label AS deviceLabel,
            is_active AS isActive, last_used_at AS lastUsedAt,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    userUuid, endpoint, authKey, p256dhKey, deviceType, deviceLabel,
  }) {
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO push_subscriptions (
        uuid, user_uuid, endpoint, auth_key, p256dh_key, device_type, device_label, is_active
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        auth_key = VALUES(auth_key), p256dh_key = VALUES(p256dh_key), is_active = 1`,
      [userUuid, endpoint, authKey, p256dhKey, deviceType ?? 'web', deviceLabel ?? null],
    );
    return this.findByEndpoint(endpoint);
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM push_subscriptions WHERE id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  async findByEndpoint(endpoint) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM push_subscriptions WHERE endpoint = ?`,
      [endpoint],
    );
    return rows[0] || null;
  }

  async findByUser(userUuid) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT ${this.columns()} FROM push_subscriptions
       WHERE user_uuid = ? AND is_active = 1 ORDER BY created_at DESC`,
      [userUuid],
    );
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE push_subscriptions SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = SuscripcionRepository;
