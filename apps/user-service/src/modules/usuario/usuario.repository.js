const { getMysqlPool } = require('../../config/database/mysql');

const PERFIL_COLUMNS = `id, uuid, user_id AS userId, first_name AS firstName,
       last_name AS lastName, document_number AS documentNumber, phone,
       avatar_file_uuid AS avatarFileUuid,
       DATE_FORMAT(birth_date, '%Y-%m-%d') AS birthDate, city_code AS cityCode,
       timezone, locale, created_at AS createdAt, updated_at AS updatedAt`;

const PREFERENCIAS_COLUMNS = `id, uuid, user_id AS userId, notify_email AS notifyEmail,
       notify_push AS notifyPush, quiet_hours_start AS quietHoursStart,
       quiet_hours_end AS quietHoursEnd, updated_at AS updatedAt`;

/**
 * Escapa los comodines de LIKE para que la búsqueda sea literal.
 * @param {string} value - Texto del usuario.
 * @returns {string}
 */
const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');

class UsuarioRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async findPerfilByUserId(userId) {
    const rows = await this.getPool().query(
      `SELECT ${PERFIL_COLUMNS}
       FROM user_profiles
       WHERE user_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  }

  async upsertPerfil(userId, data) {
    await this.getPool().query(
      `INSERT INTO user_profiles
         (user_id, first_name, last_name, document_number, phone, avatar_file_uuid,
          birth_date, city_code, timezone, locale)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         first_name = VALUES(first_name),
         last_name = VALUES(last_name),
         document_number = VALUES(document_number),
         phone = VALUES(phone),
         avatar_file_uuid = VALUES(avatar_file_uuid),
         birth_date = VALUES(birth_date),
         city_code = VALUES(city_code),
         timezone = VALUES(timezone),
         locale = VALUES(locale),
         deleted_at = NULL`,
      [
        userId,
        data.firstName,
        data.lastName,
        data.documentNumber,
        data.phone,
        data.avatarFileUuid,
        data.birthDate,
        data.cityCode,
        data.timezone,
        data.locale,
      ],
    );
    return this.findPerfilByUserId(userId);
  }

  async findPreferenciasByUserId(userId) {
    const rows = await this.getPool().query(
      `SELECT ${PREFERENCIAS_COLUMNS}
       FROM user_preferences
       WHERE user_id = ?
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  }

  async upsertPreferencias(userId, data) {
    await this.getPool().query(
      `INSERT INTO user_preferences
         (user_id, notify_email, notify_push, quiet_hours_start, quiet_hours_end)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         notify_email = VALUES(notify_email),
         notify_push = VALUES(notify_push),
         quiet_hours_start = VALUES(quiet_hours_start),
         quiet_hours_end = VALUES(quiet_hours_end)`,
      [
        userId,
        data.notifyEmail ? 1 : 0,
        data.notifyPush ? 1 : 0,
        data.quietHoursStart,
        data.quietHoursEnd,
      ],
    );
    return this.findPreferenciasByUserId(userId);
  }

  async findAllPerfiles({ limit, offset, search }) {
    const pool = this.getPool();
    const conditions = ['deleted_at IS NULL'];
    const params = [];

    if (search) {
      const term = `%${escapeLike(search)}%`;
      conditions.push(`(first_name LIKE ? OR last_name LIKE ?
        OR CONCAT(first_name, ' ', last_name) LIKE ? OR document_number LIKE ?)`);
      params.push(term, term, term, term);
    }

    const where = conditions.join(' AND ');
    const [{ total }] = await pool.query(
      `SELECT COUNT(*) AS total FROM user_profiles WHERE ${where}`,
      params,
    );
    const rows = await pool.query(
      `SELECT ${PERFIL_COLUMNS}
       FROM user_profiles
       WHERE ${where}
       ORDER BY last_name ASC, first_name ASC, id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { rows, total: Number(total) || 0 };
  }

  async softDeletePerfil(userId) {
    const result = await this.getPool().query(
      'UPDATE user_profiles SET deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL',
      [userId],
    );
    return result.affectedRows > 0;
  }
}

module.exports = UsuarioRepository;
