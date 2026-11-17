const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class PqrsRepository {
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
    return `id, uuid, ticket_number AS ticketNumber, type_id AS typeId,
            status_id AS statusId, is_anonymous AS isAnonymous,
            requester_uuid AS requesterUuid, requester_name AS requesterName,
            contact_email AS contactEmail, assignee_uuid AS assigneeUuid,
            assignee_name AS assigneeName, subject, description,
            campus_uuid AS campusUuid, campus_name AS campusName,
            due_date AS dueDate, responded_at AS respondedAt, closed_at AS closedAt,
            is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    ticketNumber, typeId, statusId, isAnonymous, requesterUuid, requesterName,
    contactEmail, subject, description, campusUuid, campusName, dueDate,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO pqrs (
        uuid, ticket_number, type_id, status_id, is_anonymous, requester_uuid,
        requester_name, contact_email, subject, description, campus_uuid,
        campus_name, due_date, is_active
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        ticketNumber, typeId, statusId, isAnonymous ? 1 : 0,
        requesterUuid ?? null, requesterName ?? null, contactEmail ?? null,
        subject, description, campusUuid ?? null, campusName ?? null, dueDate,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({
    page = 1, limit = 10, requesterUuid, assigneeUuid, statusId, typeId,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (requesterUuid) { conditions.push('requester_uuid = ?'); params.push(requesterUuid); }
    if (assigneeUuid) { conditions.push('assignee_uuid = ?'); params.push(assigneeUuid); }
    if (statusId) { conditions.push('status_id = ?'); params.push(statusId); }
    if (typeId) { conditions.push('type_id = ?'); params.push(typeId); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM pqrs ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM pqrs ${whereClause}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM pqrs WHERE id = ? AND is_active = 1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByTicketNumber(ticketNumber) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM pqrs WHERE ticket_number = ?`,
      [ticketNumber],
    );
    return rows[0] || null;
  }

  async updateStatus(id, {
    statusId, assigneeUuid, assigneeName, respondedAt, closedAt,
  }) {
    const pool = await this.getPool();
    const sets = ['status_id = ?'];
    const params = [statusId];
    if (assigneeUuid !== undefined) { sets.push('assignee_uuid = ?'); params.push(assigneeUuid); }
    if (assigneeName !== undefined) { sets.push('assignee_name = ?'); params.push(assigneeName); }
    if (respondedAt !== undefined) { sets.push('responded_at = ?'); params.push(respondedAt); }
    if (closedAt !== undefined) { sets.push('closed_at = ?'); params.push(closedAt); }

    params.push(id);
    await pool.query(`UPDATE pqrs SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  }
}

module.exports = PqrsRepository;
