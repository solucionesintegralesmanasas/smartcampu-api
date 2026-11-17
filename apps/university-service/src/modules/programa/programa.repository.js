const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class ProgramaRepository {
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
    return `id, uuid, faculty_id AS facultyId, code, name, level,
            duration_semesters AS durationSemesters, total_credits AS totalCredits,
            snies_code AS sniesCode, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    facultyId, code, name, level, durationSemesters, totalCredits, sniesCode,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO programs (
        faculty_id, code, name, level, duration_semesters, total_credits, snies_code, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [facultyId, code, name, level, durationSemesters, totalCredits, sniesCode ?? null],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10, facultyId } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1'];
    const params = [];
    if (facultyId) {
      conditions.push('faculty_id = ?');
      params.push(facultyId);
    }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM programs ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM programs ${whereClause}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM programs WHERE id = ? AND is_active = 1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByCode(code) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM programs WHERE code = ? AND is_active = 1`,
      [code],
    );
    return rows[0] || null;
  }

  async update(id, {
    name, durationSemesters, totalCredits, sniesCode,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (durationSemesters !== undefined) { sets.push('duration_semesters = ?'); params.push(durationSemesters); }
    if (totalCredits !== undefined) { sets.push('total_credits = ?'); params.push(totalCredits); }
    if (sniesCode !== undefined) { sets.push('snies_code = ?'); params.push(sniesCode); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE programs SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE programs SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }

  async countActiveStudents(programId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM students WHERE program_id = ? AND is_active = 1',
      [programId],
    );
    return rows[0].total;
  }
}

module.exports = ProgramaRepository;
