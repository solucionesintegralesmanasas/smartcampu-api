const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');

const COLUMNAS_PUBLICAS = `
  uuid, device_type AS tipoDispositivo, device_label AS etiqueta,
  is_active AS activa, created_at AS creadaEn`;

class SuscripcionesRepository {
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
   * Registra o reactiva una suscripción push. El endpoint es único: si ya existe, se reasigna.
   * @returns {Promise<Object>} Suscripción sin claves criptográficas.
   */
  async upsert(data) {
    const pool = this.getPool();
    await pool.query(
      `INSERT INTO push_subscriptions
         (uuid, user_uuid, endpoint, auth_key, p256dh_key, device_type, device_label, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         user_uuid = VALUES(user_uuid),
         auth_key = VALUES(auth_key),
         p256dh_key = VALUES(p256dh_key),
         device_type = VALUES(device_type),
         device_label = VALUES(device_label),
         is_active = 1`,
      [
        uuidv4(),
        data.userUuid,
        data.endpoint,
        data.authKey,
        data.p256dhKey,
        data.deviceType,
        data.deviceLabel ?? null,
      ],
    );
    const rows = await pool.query(
      `SELECT ${COLUMNAS_PUBLICAS} FROM push_subscriptions WHERE endpoint = ? LIMIT 1`,
      [data.endpoint],
    );
    return rows[0] ? { ...rows[0], activa: Boolean(rows[0].activa) } : null;
  }

  /**
   * Elimina una suscripción del propio usuario.
   * @returns {Promise<number>} Filas afectadas.
   */
  async deleteByUuidForUser(uuid, userUuid) {
    const result = await this.getPool().query(
      'DELETE FROM push_subscriptions WHERE uuid = ? AND user_uuid = ?',
      [uuid, userUuid],
    );
    return result.affectedRows;
  }

  /**
   * Suscripciones activas de un usuario, con las claves necesarias para el envío.
   */
  async findActiveByUser(userUuid) {
    return this.getPool().query(
      `SELECT endpoint, auth_key AS authKey, p256dh_key AS p256dhKey
       FROM push_subscriptions WHERE user_uuid = ? AND is_active = 1`,
      [userUuid],
    );
  }
}

module.exports = SuscripcionesRepository;
