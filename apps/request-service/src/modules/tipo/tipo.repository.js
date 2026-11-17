const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class TipoRepository {
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
    return `id, uuid, category_id AS categoryId, code, name, description,
            requires_approval AS requiresApproval, sla_days AS slaDays, cost,
            form_schema AS formSchema, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  hydrate(tipo) {
    if (!tipo) return null;
    if (typeof tipo.formSchema === 'string') {
      tipo.formSchema = tipo.formSchema ? JSON.parse(tipo.formSchema) : null;
    }
    return tipo;
  }

  async create({
    categoryId, code, name, description, requiresApproval, slaDays, cost, formSchema,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO request_types (
        category_id, code, name, description, requires_approval,
        sla_days, cost, form_schema, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        categoryId, code, name, description ?? null, requiresApproval === false ? 0 : 1,
        slaDays ?? null, cost ?? null, formSchema ? JSON.stringify(formSchema) : null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10, categoryId } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (categoryId) { conditions.push('category_id = ?'); params.push(categoryId); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM request_types ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM request_types ${whereClause}
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
      `SELECT ${this.columns()} FROM request_types WHERE id = ? AND is_active = 1`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async findByCode(code) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM request_types WHERE code = ? AND is_active = 1`,
      [code],
    );
    return this.hydrate(rows[0]);
  }

  async update(id, {
    name, description, slaDays, cost, formSchema,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (slaDays !== undefined) { sets.push('sla_days = ?'); params.push(slaDays); }
    if (cost !== undefined) { sets.push('cost = ?'); params.push(cost); }
    if (formSchema !== undefined) {
      sets.push('form_schema = ?');
      params.push(formSchema ? JSON.stringify(formSchema) : null);
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE request_types SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE request_types SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }

  async countActiveRequests(typeId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM requests WHERE request_type_id = ? AND is_active = 1',
      [typeId],
    );
    return rows[0].total;
  }
}

module.exports = TipoRepository;
