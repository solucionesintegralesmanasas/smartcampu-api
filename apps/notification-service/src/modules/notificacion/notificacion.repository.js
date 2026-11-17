const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class NotificacionRepository {
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
    return `id, uuid, template_id AS templateId, recipient_uuid AS recipientUuid,
            recipient_email AS recipientEmail, channel, subject, body,
            source_service AS sourceService, source_entity AS sourceEntity,
            source_uuid AS sourceUuid, status, queued_at AS queuedAt, sent_at AS sentAt,
            delivered_at AS deliveredAt, read_at AS readAt, failed_at AS failedAt,
            failure_reason AS failureReason, retry_count AS retryCount, metadata,
            queued_at AS createdAt`;
  }

  hydrate(notificacion) {
    if (!notificacion) return null;
    if (typeof notificacion.metadata === 'string') {
      notificacion.metadata = notificacion.metadata ? JSON.parse(notificacion.metadata) : null;
    }
    return notificacion;
  }

  async create({
    templateId, recipientUuid, recipientEmail, channel, subject, body,
    sourceService, sourceEntity, sourceUuid, status, deliveredAt, metadata,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO notifications (
        uuid, template_id, recipient_uuid, recipient_email, channel, subject, body,
        source_service, source_entity, source_uuid, status, delivered_at, metadata
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId ?? null, recipientUuid, recipientEmail ?? null, channel, subject ?? null, body,
        sourceService ?? null, sourceEntity ?? null, sourceUuid ?? null, status ?? 'queued',
        deliveredAt ?? null, metadata ? JSON.stringify(metadata) : null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({
    page = 1, limit = 10, recipientUuid, status, channel,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['1 = 1'];
    const params = [];
    if (recipientUuid) { conditions.push('recipient_uuid = ?'); params.push(recipientUuid); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    if (channel) { conditions.push('channel = ?'); params.push(channel); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM notifications ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM notifications ${whereClause}
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
      `SELECT ${this.columns()} FROM notifications WHERE id = ?`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async countUnread(recipientUuid) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT COUNT(*) AS total FROM notifications
       WHERE recipient_uuid = ? AND status IN ('queued', 'sending', 'delivered')`,
      [recipientUuid],
    );
    return rows[0].total;
  }

  async markRead(id) {
    const pool = await this.getPool();
    await pool.query(
      "UPDATE notifications SET status = 'read', read_at = NOW() WHERE id = ?",
      [id],
    );
    return this.findById(id);
  }

  async markAllRead(recipientUuid) {
    const pool = await this.getPool();
    const result = await pool.query(
      `UPDATE notifications SET status = 'read', read_at = NOW()
       WHERE recipient_uuid = ? AND status IN ('queued', 'sending', 'delivered')`,
      [recipientUuid],
    );
    return result.affectedRows;
  }
}

module.exports = NotificacionRepository;
