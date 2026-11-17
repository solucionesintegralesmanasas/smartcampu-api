const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class PlantillaRepository {
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
    return `id, uuid, code, name, channel, subject, body_text AS bodyText,
            body_html AS bodyHtml, variables, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  hydrate(plantilla) {
    if (!plantilla) return null;
    if (typeof plantilla.variables === 'string') {
      plantilla.variables = plantilla.variables ? JSON.parse(plantilla.variables) : null;
    }
    return plantilla;
  }

  async create({
    code, name, channel, subject, bodyText, bodyHtml, variables,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO notification_templates (
        code, name, channel, subject, body_text, body_html, variables, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        code, name, channel, subject ?? null, bodyText ?? null, bodyHtml ?? null,
        variables ? JSON.stringify(variables) : null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10, channel } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (channel) { conditions.push('channel = ?'); params.push(channel); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM notification_templates ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM notification_templates ${whereClause}
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
      `SELECT ${this.columns()} FROM notification_templates WHERE id = ? AND is_active = 1`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async findByCodeAndChannel(code, channel) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM notification_templates
       WHERE code = ? AND channel = ? AND is_active = 1`,
      [code, channel],
    );
    return this.hydrate(rows[0]);
  }

  async update(id, {
    name, subject, bodyText, bodyHtml, variables,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (subject !== undefined) { sets.push('subject = ?'); params.push(subject); }
    if (bodyText !== undefined) { sets.push('body_text = ?'); params.push(bodyText); }
    if (bodyHtml !== undefined) { sets.push('body_html = ?'); params.push(bodyHtml); }
    if (variables !== undefined) {
      sets.push('variables = ?');
      params.push(variables ? JSON.stringify(variables) : null);
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE notification_templates SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE notification_templates SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = PlantillaRepository;
