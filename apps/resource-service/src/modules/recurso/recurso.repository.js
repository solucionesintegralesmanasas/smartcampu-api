const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class RecursoRepository {
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
            campus_uuid AS campusUuid, campus_name AS campusName,
            code, name, description, capacity, floor, building,
            has_inventory AS hasInventory, attributes,
            is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  hydrate(resource) {
    if (!resource) return null;
    if (typeof resource.attributes === 'string') {
      resource.attributes = resource.attributes ? JSON.parse(resource.attributes) : null;
    }
    return resource;
  }

  async create({
    categoryId, statusId, campusUuid, campusName, code, name, description,
    capacity, floor, building, hasInventory, attributes,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO resources (
        category_id, status_id, campus_uuid, campus_name, code, name, description,
        capacity, floor, building, has_inventory, attributes, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        categoryId, statusId, campusUuid, campusName, code, name, description ?? null,
        capacity ?? null, floor ?? null, building ?? null, hasInventory ? 1 : 0,
        attributes ? JSON.stringify(attributes) : null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({
    page = 1, limit = 10, categoryId, campusUuid,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (categoryId) { conditions.push('category_id = ?'); params.push(categoryId); }
    if (campusUuid) { conditions.push('campus_uuid = ?'); params.push(campusUuid); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM resources ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM resources ${whereClause}
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
      `SELECT ${this.columns()} FROM resources WHERE id = ? AND is_active = 1`,
      [id],
    );
    return this.hydrate(rows[0]);
  }

  async findByCode(code) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM resources WHERE code = ? AND is_active = 1`,
      [code],
    );
    return this.hydrate(rows[0]);
  }

  async update(id, {
    name, description, capacity, floor, building, statusId, attributes,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (capacity !== undefined) { sets.push('capacity = ?'); params.push(capacity); }
    if (floor !== undefined) { sets.push('floor = ?'); params.push(floor); }
    if (building !== undefined) { sets.push('building = ?'); params.push(building); }
    if (statusId !== undefined) { sets.push('status_id = ?'); params.push(statusId); }
    if (attributes !== undefined) {
      sets.push('attributes = ?');
      params.push(attributes ? JSON.stringify(attributes) : null);
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE resources SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE resources SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = RecursoRepository;
