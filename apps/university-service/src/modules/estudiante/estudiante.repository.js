const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class EstudianteRepository {
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
    return `id, uuid, person_id AS personId, program_id AS programId, user_uuid AS userUuid,
            student_code AS studentCode, enrollment_date AS enrollmentDate,
            graduation_date AS graduationDate, current_semester AS currentSemester,
            gpa, status, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    personId, programId, userUuid, studentCode, enrollmentDate, currentSemester,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO students (
        uuid, person_id, program_id, user_uuid, student_code,
        enrollment_date, current_semester, status, is_active
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, 'active', 1)`,
      [personId, programId, userUuid ?? null, studentCode, enrollmentDate, currentSemester ?? null],
    );
    return this.findById(result.insertId);
  }

  async findAll({
    page = 1, limit = 10, programId, status,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1', 'deleted_at IS NULL'];
    const params = [];
    if (programId) { conditions.push('program_id = ?'); params.push(programId); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM students ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM students ${whereClause}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM students
       WHERE id = ? AND is_active = 1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] || null;
  }

  async findByPersonId(personId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM students
       WHERE person_id = ? AND is_active = 1 AND deleted_at IS NULL`,
      [personId],
    );
    return rows[0] || null;
  }

  async findByCode(studentCode) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM students
       WHERE student_code = ? AND is_active = 1 AND deleted_at IS NULL`,
      [studentCode],
    );
    return rows[0] || null;
  }

  async findByUserUuid(userUuid) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM students
       WHERE user_uuid = ? AND is_active = 1 AND deleted_at IS NULL`,
      [userUuid],
    );
    return rows[0] || null;
  }

  async update(id, {
    currentSemester, gpa, status, graduationDate,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (currentSemester !== undefined) { sets.push('current_semester = ?'); params.push(currentSemester); }
    if (gpa !== undefined) { sets.push('gpa = ?'); params.push(gpa); }
    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (graduationDate !== undefined) { sets.push('graduation_date = ?'); params.push(graduationDate); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE students SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = EstudianteRepository;
