const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');

class AuditoriaRepository {
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

  async record({
    requestId, fromStatusId, toStatusId, actorUuid, actorName, comment,
  }) {
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO request_audit_trail (
        uuid, request_id, from_status_id, to_status_id, actor_uuid, actor_name, comment
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
      [requestId, fromStatusId ?? null, toStatusId, actorUuid, actorName, comment ?? null],
    );
  }

  async findByRequestId(requestId) {
    const pool = await this.getPool();
    return pool.query(
      `SELECT id, uuid, request_id AS requestId, from_status_id AS fromStatusId,
              to_status_id AS toStatusId, actor_uuid AS actorUuid, actor_name AS actorName,
              comment, occurred_at AS occurredAt
       FROM request_audit_trail WHERE request_id = ? ORDER BY occurred_at ASC`,
      [requestId],
    );
  }
}

module.exports = AuditoriaRepository;
