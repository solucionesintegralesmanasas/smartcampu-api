const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const keep = (value, fallback) => (value !== undefined ? value : fallback);

class EstudianteRepository {
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
    const personId = data.personaId || data.person_id;
    const programId = data.programaId || data.program_id;
    const userUuid = data.userUuid || data.user_uuid || null;
    const studentCode = data.codigoEstudiante || data.student_code || data.codigo;
    const defaultDate = new Date().toISOString().split('T')[0];
    const enrollmentDate = data.fechaMatricula || data.enrollment_date || defaultDate;
    const graduationDate = data.fechaGraduacion || data.graduation_date || null;
    const currentSemester = data.semestreActual || data.current_semester || 1;
    const gpa = data.promedio !== undefined ? data.promedio : data.gpa || null;
    const status = data.estado || data.status || 'active';
    let isActive = 1;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    const result = await executor.query(
      `INSERT INTO students 
       (uuid, person_id, program_id, user_uuid, student_code, enrollment_date,
        graduation_date, current_semester, gpa, status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        personId,
        programId,
        userUuid,
        studentCode,
        enrollmentDate,
        graduationDate,
        currentSemester,
        gpa,
        status,
        isActive,
      ],
    );

    return this.findById(result.insertId, conn);
  }

  async findAll({
    page = 1, limit = 20, search, programaId, personaId, estado,
  } = {}) {
    const pool = this.getPool();
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) AS total 
      FROM students s
      INNER JOIN persons p ON s.person_id = p.id
      INNER JOIN programs pr ON s.program_id = pr.id
      WHERE s.is_active = 1 AND s.deleted_at IS NULL
    `;

    let dataSql = `
      SELECT 
        s.id, s.uuid, s.person_id AS personaId, s.program_id AS programaId,
        s.user_uuid AS userUuid, s.student_code AS codigoEstudiante,
        s.enrollment_date AS fechaMatricula, s.graduation_date AS fechaGraduacion,
        s.current_semester AS semestreActual, s.gpa AS promedio, s.status AS estado,
        s.is_active AS activo, s.created_at AS createdAt, s.updated_at AS updatedAt,
        p.document_type_code AS persona_tipoDocumento, p.document_number AS persona_numeroDocumento,
        p.first_name AS persona_primerNombre, p.last_name AS persona_primerApellido,
        CONCAT(p.first_name, ' ', p.last_name) AS persona_nombre, p.email AS persona_email,
        pr.name AS programa_nombre, pr.code AS programa_codigo
      FROM students s
      INNER JOIN persons p ON s.person_id = p.id
      INNER JOIN programs pr ON s.program_id = pr.id
      WHERE s.is_active = 1 AND s.deleted_at IS NULL
    `;
    const params = [];
    const countParams = [];

    if (search) {
      const clause = ` AND (s.student_code LIKE ? OR p.first_name LIKE ? 
        OR p.last_name LIKE ? OR p.document_number LIKE ? OR pr.name LIKE ?)`;
      countSql += clause;
      dataSql += clause;
      const term = `%${search}%`;
      countParams.push(term, term, term, term, term);
      params.push(term, term, term, term, term);
    }

    if (programaId) {
      countSql += ' AND s.program_id = ?';
      dataSql += ' AND s.program_id = ?';
      countParams.push(programaId);
      params.push(programaId);
    }

    if (personaId) {
      countSql += ' AND s.person_id = ?';
      dataSql += ' AND s.person_id = ?';
      countParams.push(personaId);
      params.push(personaId);
    }

    if (estado) {
      countSql += ' AND s.status = ?';
      dataSql += ' AND s.status = ?';
      countParams.push(estado);
      params.push(estado);
    }

    dataSql += ' ORDER BY s.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const countResult = await pool.query(countSql, countParams);
    const total = countResult[0]?.total || 0;
    const rows = await pool.query(dataSql, params);

    const formatted = rows.map((r) => this.formatStudentRow(r));

    return {
      data: formatted,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async findById(id, conn = null) {
    const executor = conn || this.getPool();
    const isUuid = typeof id === 'string' && id.length === 36;
    const queryField = isUuid ? 's.uuid' : 's.id';

    const rows = await executor.query(
      `SELECT 
        s.id, s.uuid, s.person_id AS personaId, s.program_id AS programaId,
        s.user_uuid AS userUuid, s.student_code AS codigoEstudiante,
        s.enrollment_date AS fechaMatricula, s.graduation_date AS fechaGraduacion,
        s.current_semester AS semestreActual, s.gpa AS promedio, s.status AS estado,
        s.is_active AS activo, s.created_at AS createdAt, s.updated_at AS updatedAt,
        p.document_type_code AS persona_tipoDocumento, p.document_number AS persona_numeroDocumento,
        p.first_name AS persona_primerNombre, p.last_name AS persona_primerApellido,
        CONCAT(p.first_name, ' ', p.last_name) AS persona_nombre, p.email AS persona_email,
        pr.name AS programa_nombre, pr.code AS programa_codigo
      FROM students s
      INNER JOIN persons p ON s.person_id = p.id
      INNER JOIN programs pr ON s.program_id = pr.id
      WHERE ${queryField} = ? AND s.deleted_at IS NULL LIMIT 1`,
      [id],
    );

    return rows[0] ? this.formatStudentRow(rows[0]) : null;
  }

  async findByCodigo(studentCode, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT 
        s.id, s.uuid, s.person_id AS personaId, s.program_id AS programaId,
        s.user_uuid AS userUuid, s.student_code AS codigoEstudiante,
        s.enrollment_date AS fechaMatricula, s.graduation_date AS fechaGraduacion,
        s.current_semester AS semestreActual, s.gpa AS promedio, s.status AS estado,
        s.is_active AS activo, s.created_at AS createdAt, s.updated_at AS updatedAt,
        p.document_type_code AS persona_tipoDocumento, p.document_number AS persona_numeroDocumento,
        p.first_name AS persona_primerNombre, p.last_name AS persona_primerApellido,
        CONCAT(p.first_name, ' ', p.last_name) AS persona_nombre, p.email AS persona_email,
        pr.name AS programa_nombre, pr.code AS programa_codigo
      FROM students s
      INNER JOIN persons p ON s.person_id = p.id
      INNER JOIN programs pr ON s.program_id = pr.id
      WHERE s.student_code = ? AND s.deleted_at IS NULL LIMIT 1`,
      [studentCode],
    );

    return rows[0] ? this.formatStudentRow(rows[0]) : null;
  }

  async findByPersonaId(personId, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT 
        s.id, s.uuid, s.person_id AS personaId, s.program_id AS programaId,
        s.user_uuid AS userUuid, s.student_code AS codigoEstudiante,
        s.enrollment_date AS fechaMatricula, s.graduation_date AS fechaGraduacion,
        s.current_semester AS semestreActual, s.gpa AS promedio, s.status AS estado,
        s.is_active AS activo, s.created_at AS createdAt, s.updated_at AS updatedAt,
        p.document_type_code AS persona_tipoDocumento, p.document_number AS persona_numeroDocumento,
        p.first_name AS persona_primerNombre, p.last_name AS persona_primerApellido,
        CONCAT(p.first_name, ' ', p.last_name) AS persona_nombre, p.email AS persona_email,
        pr.name AS programa_nombre, pr.code AS programa_codigo
      FROM students s
      INNER JOIN persons p ON s.person_id = p.id
      INNER JOIN programs pr ON s.program_id = pr.id
      WHERE s.person_id = ? AND s.deleted_at IS NULL LIMIT 1`,
      [personId],
    );

    return rows[0] ? this.formatStudentRow(rows[0]) : null;
  }

  async update(id, data, conn = null) {
    const executor = conn || this.getPool();
    const existing = await this.findById(id, conn);
    if (!existing) return null;

    const programId = keep(data.programaId, existing.programaId);
    const userUuid = keep(data.userUuid, existing.userUuid);
    const studentCode = keep(data.codigoEstudiante, existing.codigoEstudiante);
    const enrollmentDate = keep(data.fechaMatricula, existing.fechaMatricula);
    const graduationDate = keep(data.fechaGraduacion, existing.fechaGraduacion);
    const currentSemester = keep(data.semestreActual, existing.semestreActual);
    const gpa = keep(data.promedio, existing.promedio);
    const status = data.estado !== undefined ? data.estado : existing.estado;
    let isActive = existing.activo;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    await executor.query(
      `UPDATE students 
       SET program_id = ?, user_uuid = ?, student_code = ?, enrollment_date = ?,
           graduation_date = ?, current_semester = ?, gpa = ?, status = ?, is_active = ?
       WHERE id = ?`,
      [
        programId,
        userUuid,
        studentCode,
        enrollmentDate,
        graduationDate,
        currentSemester,
        gpa,
        status,
        isActive,
        existing.id,
      ],
    );

    return this.findById(existing.id, conn);
  }

  async delete(id, conn = null) {
    const executor = conn || this.getPool();
    const result = await executor.query(
      'UPDATE students SET is_active = 0, deleted_at = NOW() WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  }

  formatStudentRow(row) {
    const {
      persona_tipoDocumento: personaTipoDocumento,
      persona_numeroDocumento: personaNumeroDocumento,
      persona_primerNombre: _primerNombre,
      persona_primerApellido: _primerApellido,
      persona_nombre: personaNombre,
      persona_email: personaEmail,
      programa_nombre: programaNombre,
      programa_codigo: programaCodigo,
      ...studentData
    } = row;

    studentData.Tercero = {
      id: studentData.personaId,
      tipoDocumento: personaTipoDocumento,
      numeroDocumento: personaNumeroDocumento,
      nombre: personaNombre,
      email: personaEmail,
    };
    studentData.tercero = studentData.Tercero;

    studentData.Programa = {
      id: studentData.programaId,
      nombre: programaNombre,
      codigo: programaCodigo,
    };
    studentData.programa = studentData.Programa;

    return studentData;
  }
}

module.exports = EstudianteRepository;
