const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');

class PreferenciasRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  /**
   * Preferencias guardadas de un usuario (sólo las que tienen registro).
   * @returns {Promise<Array<{categoria: string, canal: string, habilitado: boolean}>>}
   */
  async findByUser(userUuid) {
    const rows = await this.getPool().query(
      `SELECT category AS categoria, channel AS canal, is_enabled AS habilitado
       FROM user_notification_preferences WHERE user_uuid = ?`,
      [userUuid],
    );
    return rows.map((row) => ({ ...row, habilitado: Boolean(row.habilitado) }));
  }

  /**
   * Indica si un canal está habilitado para una categoría. Sin registro, se considera habilitado.
   * @returns {Promise<boolean>}
   */
  async isEnabled(userUuid, category, channel) {
    const rows = await this.getPool().query(
      `SELECT is_enabled AS habilitado FROM user_notification_preferences
       WHERE user_uuid = ? AND category = ? AND channel = ? LIMIT 1`,
      [userUuid, category, channel],
    );
    if (!rows.length) return true;
    return Boolean(rows[0].habilitado);
  }

  /**
   * Inserta o actualiza varias preferencias en una sola transacción.
   * @param {string} userUuid
   * @param {Array<{categoria: string, canal: string, habilitado: boolean}>} items
   */
  async upsertMany(userUuid, items) {
    const conn = await this.getPool().beginTransaction();
    try {
      await Promise.all(items.map((item) => conn.query(
        `INSERT INTO user_notification_preferences
           (uuid, user_uuid, category, channel, is_enabled)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled)`,
        [uuidv4(), userUuid, item.categoria, item.canal, item.habilitado ? 1 : 0],
      )));
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}

module.exports = PreferenciasRepository;
