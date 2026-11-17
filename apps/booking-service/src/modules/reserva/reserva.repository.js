const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class ReservaRepository {
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
    return `id, uuid, reference_number AS referenceNumber, booking_type_id AS bookingTypeId,
            status_id AS statusId, resource_uuid AS resourceUuid, resource_name AS resourceName,
            requester_uuid AS requesterUuid, requester_name AS requesterName,
            approver_uuid AS approverUuid, title, description,
            booking_date AS bookingDate, start_time AS startTime, end_time AS endTime,
            requested_at AS requestedAt, approved_at AS approvedAt, cancelled_at AS cancelledAt,
            completed_at AS completedAt, cancellation_reason AS cancellationReason,
            expected_attendees AS expectedAttendees, metadata,
            is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  hydrate(booking) {
    if (!booking) return null;
    if (typeof booking.metadata === 'string') {
      booking.metadata = booking.metadata ? JSON.parse(booking.metadata) : null;
    }
    return booking;
  }

  async create({
    referenceNumber, bookingTypeId, statusId, resourceUuid, resourceName,
    requesterUuid, requesterName, title, description, bookingDate, startTime,
    endTime, expectedAttendees, metadata,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO bookings (
        uuid, reference_number, booking_type_id, status_id, resource_uuid, resource_name,
        requester_uuid, requester_name, title, description, booking_date, start_time, end_time,
        expected_attendees, metadata, is_active
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        referenceNumber, bookingTypeId, statusId, resourceUuid, resourceName,
        requesterUuid, requesterName, title, description ?? null, bookingDate, startTime, endTime,
        expectedAttendees ?? null, metadata ? JSON.stringify(metadata) : null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({
    page = 1, limit = 10, requesterUuid, statusId, resourceUuid,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (requesterUuid) { conditions.push('requester_uuid = ?'); params.push(requesterUuid); }
    if (statusId) { conditions.push('status_id = ?'); params.push(statusId); }
    if (resourceUuid) { conditions.push('resource_uuid = ?'); params.push(resourceUuid); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM bookings ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM bookings ${whereClause}
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
      `SELECT ${this.columns()} FROM bookings WHERE id = ? AND is_active = 1`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async findByReferenceNumber(referenceNumber) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM bookings WHERE reference_number = ?`,
      [referenceNumber],
    );
    return this.hydrate(rows[0]);
  }

  /**
   * ¿Existe una reserva activa (no cancelada/rechazada) del mismo recurso
   * que se traslape con [startTime, endTime) en booking_date?
   */
  async findOverlapping(resourceUuid, bookingDate, startTime, endTime, excludeBookingId = null) {
    const pool = await this.getPool();
    const params = [resourceUuid, bookingDate, endTime, startTime];
    let sql = `SELECT ${this.columns()} FROM bookings
       WHERE resource_uuid = ? AND booking_date = ? AND is_active = 1
             AND status_id IN (
               SELECT id FROM booking_statuses WHERE code NOT IN ('rejected', 'cancelled')
             )
             AND start_time < ? AND end_time > ?`;
    if (excludeBookingId) {
      sql += ' AND id != ?';
      params.push(excludeBookingId);
    }
    sql += ' LIMIT 1';
    const rows = await pool.query(sql, params);
    return this.hydrate(rows[0]);
  }

  async updateStatus(id, {
    statusId, approverUuid, approvedAt, cancelledAt, completedAt, cancellationReason,
  }) {
    const pool = await this.getPool();
    const sets = ['status_id = ?'];
    const params = [statusId];
    if (approverUuid !== undefined) { sets.push('approver_uuid = ?'); params.push(approverUuid); }
    if (approvedAt !== undefined) { sets.push('approved_at = ?'); params.push(approvedAt); }
    if (cancelledAt !== undefined) { sets.push('cancelled_at = ?'); params.push(cancelledAt); }
    if (completedAt !== undefined) { sets.push('completed_at = ?'); params.push(completedAt); }
    if (cancellationReason !== undefined) { sets.push('cancellation_reason = ?'); params.push(cancellationReason); }

    params.push(id);
    await pool.query(`UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }
}

module.exports = ReservaRepository;
