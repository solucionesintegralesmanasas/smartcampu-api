const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class FacultadRepository {
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
    return `id, uuid, campus_id AS campusId, code, name,
            dean_name AS deanName, email, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    campusId, code, name, deanName, email,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO faculties (campus_id, code, name, dean_name, email, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [campusId, code, name, deanName ?? null, email ?? null],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10, campusId } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (campusId) {
      conditions.push('campus_id = ?');
      params.push(campusId);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM faculties ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM faculties ${whereClause}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM faculties WHERE id = ? AND is_active = 1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByCode(code) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM faculties WHERE code = ? AND is_active = 1`,
      [code],
    );
    return rows[0] || null;
  }

  async update(id, { name, deanName, email }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (deanName !== undefined) { sets.push('dean_name = ?'); params.push(deanName); }
    if (email !== undefined) { sets.push('email = ?'); params.push(email); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE faculties SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE faculties SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }

  async countActivePrograms(facultadId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM programs WHERE faculty_id = ? AND is_active = 1',
      [facultadId],
    );
    return rows[0].total;
  }

  async countActiveTeachers(facultadId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM teachers WHERE faculty_id = ? AND is_active = 1',
      [facultadId],
    );
    return rows[0].total;
  }
}

module.exports = FacultadRepository;
