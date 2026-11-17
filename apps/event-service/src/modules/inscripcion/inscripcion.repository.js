const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class InscripcionRepository {
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
    return `id, uuid, event_id AS eventId, registrant_uuid AS registrantUuid,
            registrant_name AS registrantName, status, registered_at AS registeredAt,
            confirmed_at AS confirmedAt, cancelled_at AS cancelledAt, attended_at AS attendedAt,
            qr_code AS qrCode, notes`;
  }

  async create({
    eventId, registrantUuid, registrantName, status, qrCode,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO event_registrations
         (uuid, event_id, registrant_uuid, registrant_name, status, qr_code)
       VALUES (UUID(), ?, ?, ?, ?, ?)`,
      [eventId, registrantUuid, registrantName, status, qrCode ?? null],
    );
    return this.findById(result.insertId);
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM event_registrations WHERE id = ?`,
      [id],
    );
    return rows[0] || null;
  }

  async findByEventAndRegistrant(eventId, registrantUuid) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM event_registrations
       WHERE event_id = ? AND registrant_uuid = ?`,
      [eventId, registrantUuid],
    );
    return rows[0] || null;
  }

  async findByEventId(eventId) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT ${this.columns()} FROM event_registrations
       WHERE event_id = ? ORDER BY registered_at ASC`,
      [eventId],
    );
  }

  async countByStatus(eventId, status) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ? AND status = ?',
      [eventId, status],
    );
    return rows[0].total;
  }

  async findOldestWaitlisted(eventId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM event_registrations
       WHERE event_id = ? AND status = 'waitlisted' ORDER BY registered_at ASC LIMIT 1`,
      [eventId],
    );
    return rows[0] || null;
  }

  async updateStatus(id, {
    status, confirmedAt, cancelledAt, attendedAt, qrCode,
  }) {
    const pool = await this.getPool();
    const sets = ['status = ?'];
    const params = [status];
    if (confirmedAt !== undefined) { sets.push('confirmed_at = ?'); params.push(confirmedAt); }
    if (cancelledAt !== undefined) { sets.push('cancelled_at = ?'); params.push(cancelledAt); }
    if (attendedAt !== undefined) { sets.push('attended_at = ?'); params.push(attendedAt); }
    if (qrCode !== undefined) { sets.push('qr_code = ?'); params.push(qrCode); }

    params.push(id);
    await pool.query(`UPDATE event_registrations SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }
}

module.exports = InscripcionRepository;
