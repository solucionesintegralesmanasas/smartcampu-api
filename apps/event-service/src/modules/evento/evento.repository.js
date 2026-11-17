const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class EventoRepository {
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
    return `id, uuid, category_id AS categoryId, status_id AS statusId,
            organizer_uuid AS organizerUuid, organizer_name AS organizerName,
            campus_uuid AS campusUuid, campus_name AS campusName,
            title, slug, description, venue, starts_at AS startsAt, ends_at AS endsAt,
            max_capacity AS maxCapacity, cost, requires_registration AS requiresRegistration,
            registration_deadline AS registrationDeadline, cover_image_uuid AS coverImageUuid,
            metadata, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  hydrate(evento) {
    if (!evento) return null;
    if (typeof evento.metadata === 'string') {
      evento.metadata = evento.metadata ? JSON.parse(evento.metadata) : null;
    }
    return evento;
  }

  async create({
    categoryId, statusId, organizerUuid, organizerName, campusUuid, campusName,
    title, slug, description, venue, startsAt, endsAt, maxCapacity, cost,
    requiresRegistration, registrationDeadline, metadata,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO events (
        uuid, category_id, status_id, organizer_uuid, organizer_name, campus_uuid, campus_name,
        title, slug, description, venue, starts_at, ends_at, max_capacity, cost,
        requires_registration, registration_deadline, metadata, is_active
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        categoryId, statusId, organizerUuid, organizerName, campusUuid, campusName,
        title, slug ?? null, description ?? null, venue ?? null, startsAt, endsAt,
        maxCapacity ?? null, cost ?? 0, requiresRegistration ? 1 : 0,
        registrationDeadline ?? null, metadata ? JSON.stringify(metadata) : null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({
    page = 1, limit = 10, categoryId, statusId, organizerUuid,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (categoryId) { conditions.push('category_id = ?'); params.push(categoryId); }
    if (statusId) { conditions.push('status_id = ?'); params.push(statusId); }
    if (organizerUuid) { conditions.push('organizer_uuid = ?'); params.push(organizerUuid); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM events ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM events ${whereClause}
       ORDER BY starts_at DESC LIMIT ? OFFSET ?`,
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
      `SELECT ${this.columns()} FROM events WHERE id = ? AND is_active = 1`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async findBySlug(slug) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM events WHERE slug = ? AND is_active = 1`,
      [slug],
    );
    return this.hydrate(rows[0]);
  }

  async update(id, {
    title, description, venue, startsAt, endsAt, maxCapacity, cost, registrationDeadline, metadata,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (venue !== undefined) { sets.push('venue = ?'); params.push(venue); }
    if (startsAt !== undefined) { sets.push('starts_at = ?'); params.push(startsAt); }
    if (endsAt !== undefined) { sets.push('ends_at = ?'); params.push(endsAt); }
    if (maxCapacity !== undefined) { sets.push('max_capacity = ?'); params.push(maxCapacity); }
    if (cost !== undefined) { sets.push('cost = ?'); params.push(cost); }
    if (registrationDeadline !== undefined) {
      sets.push('registration_deadline = ?');
      params.push(registrationDeadline);
    }
    if (metadata !== undefined) {
      sets.push('metadata = ?');
      params.push(metadata ? JSON.stringify(metadata) : null);
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async updateStatus(id, statusId) {
    const pool = await this.getPool();
    await pool.query('UPDATE events SET status_id = ? WHERE id = ?', [statusId, id]);
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE events SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = EventoRepository;
