const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class PreferenciaRepository {
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
    return `id, uuid, user_uuid AS userUuid, category, channel,
            is_enabled AS isEnabled, updated_at AS updatedAt`;
  }

  async findByUser(userUuid) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT ${this.columns()} FROM user_notification_preferences
       WHERE user_uuid = ? ORDER BY category ASC, channel ASC`,
      [userUuid],
    );
  }

  async findOne(userUuid, category, channel) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM user_notification_preferences
       WHERE user_uuid = ? AND category = ? AND channel = ?`,
      [userUuid, category, channel],
    );
    return rows[0] || null;
  }

  async upsert({
    userUuid, category, channel, isEnabled,
  }) {
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO user_notification_preferences (uuid, user_uuid, category, channel, is_enabled)
       VALUES (UUID(), ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled)`,
      [userUuid, category, channel, isEnabled ? 1 : 0],
    );
    return this.findOne(userUuid, category, channel);
  }

  /**
   * Si no hay preferencia explícita, el canal se considera habilitado por
   * defecto — el usuario debe optar por desactivarlo, no al revés.
   */
  async isChannelEnabled(userUuid, category, channel) {
    const preference = await this.findOne(userUuid, category, channel);
    return preference ? Boolean(preference.isEnabled) : true;
  }
}

module.exports = PreferenciaRepository;
