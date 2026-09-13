const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const keep = (value, fallback) => (value !== undefined ? value : fallback);

class ProgramaRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async withTransaction(callback) {
    const pool = this.getPool();
    const conn = await pool.beginTransaction();
    try {
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async create(data, conn = null) {
    const executor = conn || this.getPool();
    const uuid = data.uuid || uuidv4();
    const facultyId = data.facultadId || data.faculty_id;
    const code = data.codigo || data.code;
    const name = data.nombre || data.name;
    const level = data.nivel || data.level || 'undergraduate';
    const durationSemesters = data.duracionSemestres || data.duration_semesters;
    const totalCredits = data.creditosTotales || data.total_credits;
    const sniesCode = data.codigoSnies || data.snies_code || null;
    let isActive = 1;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    const result = await executor.query(
      `INSERT INTO programs 
       (uuid, faculty_id, code, name, level,
        duration_semesters, total_credits, snies_code, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuid, facultyId, code, name, level, durationSemesters, totalCredits, sniesCode, isActive],
    );

    return this.findById(result.insertId, conn);
  }

  async findAll({
    page = 1, limit = 20, search, facultadId, nivel,
  } = {}) {
    const pool = this.getPool();
    const offset = (page - 1) * limit;

    let countSql = 'SELECT COUNT(*) AS total FROM programs p WHERE p.is_active = 1';
    let dataSql = `
      SELECT 
        p.id, p.uuid, p.faculty_id AS facultadId, p.code AS codigo, p.name AS nombre,
        p.level AS nivel, p.duration_semesters AS duracionSemestres,
        p.total_credits AS creditosTotales, p.snies_code AS codigoSnies,
        p.is_active AS activo, p.created_at AS createdAt, p.updated_at AS updatedAt,
        f.id AS facultad_id, f.name AS facultad_nombre, f.code AS facultad_codigo
      FROM programs p
      INNER JOIN faculties f ON p.faculty_id = f.id
      WHERE p.is_active = 1
    `;
    const params = [];
    const countParams = [];

    if (search) {
      const clause = ' AND (p.name LIKE ? OR p.code LIKE ? OR p.snies_code LIKE ?)';
      countSql += clause;
      dataSql += clause;
      const term = `%${search}%`;
      countParams.push(term, term, term);
      params.push(term, term, term);
    }

    if (facultadId) {
      countSql += ' AND p.faculty_id = ?';
      dataSql += ' AND p.faculty_id = ?';
      countParams.push(facultadId);
      params.push(facultadId);
    }

    if (nivel) {
      countSql += ' AND p.level = ?';
      dataSql += ' AND p.level = ?';
      countParams.push(nivel);
      params.push(nivel);
    }

    dataSql += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const countResult = await pool.query(countSql, countParams);
    const total = countResult[0]?.total || 0;
    const rows = await pool.query(dataSql, params);

    const formatted = rows.map((r) => this.formatProgramRow(r));

    return {
      data: formatted,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async findById(id, conn = null) {
    const executor = conn || this.getPool();
    const isUuid = typeof id === 'string' && id.length === 36;
    const queryField = isUuid ? 'p.uuid' : 'p.id';

    const rows = await executor.query(
      `SELECT 
        p.id, p.uuid, p.faculty_id AS facultadId, p.code AS codigo, p.name AS nombre,
        p.level AS nivel, p.duration_semesters AS duracionSemestres,
        p.total_credits AS creditosTotales, p.snies_code AS codigoSnies,
        p.is_active AS activo, p.created_at AS createdAt, p.updated_at AS updatedAt,
        f.id AS facultad_id, f.name AS facultad_nombre, f.code AS facultad_codigo
      FROM programs p
      INNER JOIN faculties f ON p.faculty_id = f.id
      WHERE ${queryField} = ? LIMIT 1`,
      [id],
    );

    return rows[0] ? this.formatProgramRow(rows[0]) : null;
  }

  async findByCodigo(code, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT 
        p.id, p.uuid, p.faculty_id AS facultadId, p.code AS codigo, p.name AS nombre,
        p.level AS nivel, p.duration_semesters AS duracionSemestres,
        p.total_credits AS creditosTotales, p.snies_code AS codigoSnies,
        p.is_active AS activo, p.created_at AS createdAt, p.updated_at AS updatedAt,
        f.id AS facultad_id, f.name AS facultad_nombre, f.code AS facultad_codigo
      FROM programs p
      INNER JOIN faculties f ON p.faculty_id = f.id
      WHERE p.code = ? LIMIT 1`,
      [code],
    );

    return rows[0] ? this.formatProgramRow(rows[0]) : null;
  }

  async findByNombre(name, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT 
        p.id, p.uuid, p.faculty_id AS facultadId, p.code AS codigo, p.name AS nombre,
        p.level AS nivel, p.duration_semesters AS duracionSemestres,
        p.total_credits AS creditosTotales, p.snies_code AS codigoSnies,
        p.is_active AS activo, p.created_at AS createdAt, p.updated_at AS updatedAt,
        f.id AS facultad_id, f.name AS facultad_nombre, f.code AS facultad_codigo
      FROM programs p
      INNER JOIN faculties f ON p.faculty_id = f.id
      WHERE p.name = ? LIMIT 1`,
      [name],
    );

    return rows[0] ? this.formatProgramRow(rows[0]) : null;
  }

  async update(id, data, conn = null) {
    const executor = conn || this.getPool();
    const existing = await this.findById(id, conn);
    if (!existing) return null;

    const facultyId = keep(data.facultadId, existing.facultadId);
    const code = keep(data.codigo, existing.codigo);
    const name = keep(data.nombre, existing.nombre);
    const level = keep(data.nivel, existing.nivel);
    const durationSemesters = keep(data.duracionSemestres, existing.duracionSemestres);
    const totalCredits = keep(data.creditosTotales, existing.creditosTotales);
    const sniesCode = keep(data.codigoSnies, existing.codigoSnies);
    let isActive = existing.activo;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    await executor.query(
      `UPDATE programs 
       SET faculty_id = ?, code = ?, name = ?, level = ?, duration_semesters = ?,
           total_credits = ?, snies_code = ?, is_active = ?
       WHERE id = ?`,
      [
        facultyId,
        code,
        name,
        level,
        durationSemesters,
        totalCredits,
        sniesCode,
        isActive,
        existing.id,
      ],
    );

    return this.findById(existing.id, conn);
  }

  async countStudentLinks(programId, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      'SELECT COUNT(*) AS total FROM students WHERE program_id = ? AND is_active = 1',
      [programId],
    );
    return rows[0]?.total || 0;
  }

  async delete(id, conn = null) {
    const executor = conn || this.getPool();
    const result = await executor.query('UPDATE programs SET is_active = 0 WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  formatProgramRow(row) {
    const {
      facultad_id: facultadId,
      facultad_nombre: facultadNombre,
      facultad_codigo: facultadCodigo,
      ...programData
    } = row;

    programData.Facultad = {
      id: facultadId,
      nombre: facultadNombre,
      codigo: facultadCodigo,
    };
    programData.facultad = programData.Facultad;

    return programData;
  }
}

module.exports = ProgramaRepository;
