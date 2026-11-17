const { getMysqlPool } = require('../../config/database/mysql');
const { addDays } = require('../../core/helpers/time.helper');
const { identifierField } = require('../../core/helpers/sql.helper');

const SELECT_BLACKOUT = `SELECT id, uuid,
    DATE_FORMAT(starts_at, '%Y-%m-%dT%H:%i') AS inicio,
    DATE_FORMAT(ends_at, '%Y-%m-%dT%H:%i') AS fin,
    reason AS motivo, created_by_uuid AS creadoPor
  FROM resource_blackouts`;

class BlackoutsRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async findByResource(resourceId, { limit, offset }) {
    const pool = this.getPool();
    const [countRow] = await pool.query(
      'SELECT COUNT(*) AS total FROM resource_blackouts WHERE resource_id = ?',
      [resourceId],
    );
    const rows = await pool.query(
      `${SELECT_BLACKOUT} WHERE resource_id = ? ORDER BY starts_at ASC LIMIT ? OFFSET ?`,
      [resourceId, limit, offset],
    );
    return { rows, total: countRow.total };
  }

  /**
   * Bloqueos que intersecan el día indicado. Las fechas se devuelven como
   * 'YYYY-MM-DD HH:mm:ss' para compararlas sin conversiones de zona horaria.
   */
  async findOverlappingDay(resourceId, fecha) {
    return this.getPool().query(
      `SELECT DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS inicio,
          DATE_FORMAT(ends_at, '%Y-%m-%d %H:%i:%s') AS fin,
          reason AS motivo
        FROM resource_blackouts
        WHERE resource_id = ? AND starts_at < ? AND ends_at > ?`,
      [resourceId, `${addDays(fecha, 1)} 00:00:00`, `${fecha} 00:00:00`],
    );
  }

  async findOne(resourceId, identifier) {
    const [row] = await this.getPool().query(
      `${SELECT_BLACKOUT} WHERE resource_id = ? AND ${identifierField(identifier)} = ? LIMIT 1`,
      [resourceId, identifier],
    );
    return row || null;
  }

  async create({
    resourceId, inicio, fin, motivo, createdByUuid,
  }) {
    const result = await this.getPool().query(
      `INSERT INTO resource_blackouts (resource_id, starts_at, ends_at, reason, created_by_uuid)
       VALUES (?, ?, ?, ?, ?)`,
      [resourceId, inicio, fin, motivo, createdByUuid],
    );
    return result.insertId;
  }

  async delete(id) {
    await this.getPool().query('DELETE FROM resource_blackouts WHERE id = ?', [id]);
  }
}

module.exports = BlackoutsRepository;
