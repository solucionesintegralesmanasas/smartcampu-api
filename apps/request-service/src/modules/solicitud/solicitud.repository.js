const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class SolicitudRepository {
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
    return `id, uuid, ticket_number AS ticketNumber, request_type_id AS requestTypeId,
            status_id AS statusId, requester_uuid AS requesterUuid, requester_name AS requesterName,
            assignee_uuid AS assigneeUuid, assignee_name AS assigneeName,
            title, description, form_data AS formData, resolution_notes AS resolutionNotes,
            due_date AS dueDate, resolved_at AS resolvedAt,
            is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  hydrate(request) {
    if (!request) return null;
    if (typeof request.formData === 'string') {
      request.formData = request.formData ? JSON.parse(request.formData) : null;
    }
    return request;
  }

  async create({
    ticketNumber, requestTypeId, statusId, requesterUuid, requesterName,
    title, description, formData, dueDate,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO requests (
        uuid, ticket_number, request_type_id, status_id, requester_uuid, requester_name,
        title, description, form_data, due_date, is_active
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        ticketNumber, requestTypeId, statusId, requesterUuid, requesterName,
        title, description, formData ? JSON.stringify(formData) : null, dueDate ?? null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({
    page = 1, limit = 10, requesterUuid, assigneeUuid, statusId,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (requesterUuid) { conditions.push('requester_uuid = ?'); params.push(requesterUuid); }
    if (assigneeUuid) { conditions.push('assignee_uuid = ?'); params.push(assigneeUuid); }
    if (statusId) { conditions.push('status_id = ?'); params.push(statusId); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM requests ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM requests ${whereClause}
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
      `SELECT ${this.columns()} FROM requests WHERE id = ? AND is_active = 1`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async findByTicketNumber(ticketNumber) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM requests WHERE ticket_number = ?`,
      [ticketNumber],
    );
    return this.hydrate(rows[0]);
  }

  async updateStatus(id, {
    statusId, assigneeUuid, assigneeName, resolutionNotes, resolvedAt,
  }) {
    const pool = await this.getPool();
    const sets = ['status_id = ?'];
    const params = [statusId];
    if (assigneeUuid !== undefined) { sets.push('assignee_uuid = ?'); params.push(assigneeUuid); }
    if (assigneeName !== undefined) { sets.push('assignee_name = ?'); params.push(assigneeName); }
    if (resolutionNotes !== undefined) { sets.push('resolution_notes = ?'); params.push(resolutionNotes); }
    if (resolvedAt !== undefined) { sets.push('resolved_at = ?'); params.push(resolvedAt); }

    params.push(id);
    await pool.query(`UPDATE requests SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }
}

module.exports = SolicitudRepository;
