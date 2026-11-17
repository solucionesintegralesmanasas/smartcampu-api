const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class DocenteRepository {
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
    return `id, uuid, person_id AS personId, faculty_id AS facultyId, user_uuid AS userUuid,
            teacher_code AS teacherCode, contract_type AS contractType,
            hire_date AS hireDate, termination_date AS terminationDate,
            academic_degree AS academicDegree, status, is_active AS isActive,
            created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    personId, facultyId, userUuid, teacherCode, contractType, hireDate, academicDegree,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO teachers (
        uuid, person_id, faculty_id, user_uuid, teacher_code,
        contract_type, hire_date, academic_degree, status, is_active
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 'active', 1)`,
      [
        personId, facultyId, userUuid ?? null, teacherCode,
        contractType, hireDate, academicDegree ?? null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({
    page = 1, limit = 10, facultyId, status,
  } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const conditions = ['is_active = 1', 'deleted_at IS NULL'];
    const params = [];
    if (facultyId) { conditions.push('faculty_id = ?'); params.push(facultyId); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM teachers ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM teachers ${whereClause}
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM teachers
       WHERE id = ? AND is_active = 1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] || null;
  }

  async findByPersonId(personId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM teachers
       WHERE person_id = ? AND is_active = 1 AND deleted_at IS NULL`,
      [personId],
    );
    return rows[0] || null;
  }

  async findByCode(teacherCode) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM teachers
       WHERE teacher_code = ? AND is_active = 1 AND deleted_at IS NULL`,
      [teacherCode],
    );
    return rows[0] || null;
  }

  async findByUserUuid(userUuid) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM teachers
       WHERE user_uuid = ? AND is_active = 1 AND deleted_at IS NULL`,
      [userUuid],
    );
    return rows[0] || null;
  }

  async update(id, {
    academicDegree, status, terminationDate,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (academicDegree !== undefined) { sets.push('academic_degree = ?'); params.push(academicDegree); }
    if (status !== undefined) { sets.push('status = ?'); params.push(status); }
    if (terminationDate !== undefined) { sets.push('termination_date = ?'); params.push(terminationDate); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE teachers SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE teachers SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = DocenteRepository;
