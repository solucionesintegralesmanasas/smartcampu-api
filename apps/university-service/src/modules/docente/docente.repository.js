const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const keep = (value, fallback) => (value !== undefined ? value : fallback);

class DocenteRepository {
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
    const facultyId = data.facultadId || data.faculty_id;
    const userUuid = data.userUuid || data.user_uuid || null;
    const teacherCode = data.codigoDocente || data.teacher_code || data.codigo;
    const contractType = data.tipoContrato || data.contract_type || 'full_time';
    const defaultDate = new Date().toISOString().split('T')[0];
    const hireDate = data.fechaContratacion || data.hire_date || defaultDate;
    const terminationDate = data.fechaTerminacion || data.termination_date || null;
    const academicDegree = data.tituloAcademico || data.academic_degree || null;
    const status = data.estado || data.status || 'active';
    let isActive = 1;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    const result = await executor.query(
      `INSERT INTO teachers 
       (uuid, person_id, faculty_id, user_uuid, teacher_code, contract_type,
        hire_date, termination_date, academic_degree, status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        personId,
        facultyId,
        userUuid,
        teacherCode,
        contractType,
        hireDate,
        terminationDate,
        academicDegree,
        status,
        isActive,
      ],
    );

    return this.findById(result.insertId, conn);
  }

  async findAll({
    page = 1,
    limit = 20,
    search,
    facultadId,
    personaId,
    estado,
    tipoContrato,
  } = {}) {
    const pool = this.getPool();
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) AS total 
      FROM teachers t
      INNER JOIN persons p ON t.person_id = p.id
      INNER JOIN faculties f ON t.faculty_id = f.id
      WHERE t.is_active = 1 AND t.deleted_at IS NULL
    `;

    let dataSql = `
      SELECT 
        t.id, t.uuid, t.person_id AS personaId, t.faculty_id AS facultadId,
        t.user_uuid AS userUuid, t.teacher_code AS codigoDocente,
        t.contract_type AS tipoContrato, t.hire_date AS fechaContratacion,
        t.termination_date AS fechaTerminacion, t.academic_degree AS tituloAcademico,
        t.status AS estado, t.is_active AS activo, t.created_at AS createdAt,
        t.updated_at AS updatedAt,
        p.document_type_code AS persona_tipoDocumento, p.document_number AS persona_numeroDocumento,
        p.first_name AS persona_primerNombre, p.last_name AS persona_primerApellido,
        CONCAT(p.first_name, ' ', p.last_name) AS persona_nombre, p.email AS persona_email,
        f.name AS facultad_nombre, f.code AS facultad_codigo
      FROM teachers t
      INNER JOIN persons p ON t.person_id = p.id
      INNER JOIN faculties f ON t.faculty_id = f.id
      WHERE t.is_active = 1 AND t.deleted_at IS NULL
    `;
    const params = [];
    const countParams = [];

    if (search) {
      const clause = ` AND (t.teacher_code LIKE ? OR p.first_name LIKE ? 
        OR p.last_name LIKE ? OR p.document_number LIKE ? OR f.name LIKE ?)`;
      countSql += clause;
      dataSql += clause;
      const term = `%${search}%`;
      countParams.push(term, term, term, term, term);
      params.push(term, term, term, term, term);
    }

    if (facultadId) {
      countSql += ' AND t.faculty_id = ?';
      dataSql += ' AND t.faculty_id = ?';
      countParams.push(facultadId);
      params.push(facultadId);
    }

    if (personaId) {
      countSql += ' AND t.person_id = ?';
      dataSql += ' AND t.person_id = ?';
      countParams.push(personaId);
      params.push(personaId);
    }

    if (estado) {
      countSql += ' AND t.status = ?';
      dataSql += ' AND t.status = ?';
      countParams.push(estado);
      params.push(estado);
    }

    if (tipoContrato) {
      countSql += ' AND t.contract_type = ?';
      dataSql += ' AND t.contract_type = ?';
      countParams.push(tipoContrato);
      params.push(tipoContrato);
    }

    dataSql += ' ORDER BY t.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const countResult = await pool.query(countSql, countParams);
    const total = countResult[0]?.total || 0;
    const rows = await pool.query(dataSql, params);

    const formatted = rows.map((r) => this.formatTeacherRow(r));

    return {
      data: formatted,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async findById(id, conn = null) {
    const executor = conn || this.getPool();
    const isUuid = typeof id === 'string' && id.length === 36;
    const queryField = isUuid ? 't.uuid' : 't.id';

    const rows = await executor.query(
      `SELECT 
        t.id, t.uuid, t.person_id AS personaId, t.faculty_id AS facultadId,
        t.user_uuid AS userUuid, t.teacher_code AS codigoDocente,
        t.contract_type AS tipoContrato, t.hire_date AS fechaContratacion,
        t.termination_date AS fechaTerminacion, t.academic_degree AS tituloAcademico,
        t.status AS estado, t.is_active AS activo, t.created_at AS createdAt,
        t.updated_at AS updatedAt,
        p.document_type_code AS persona_tipoDocumento, p.document_number AS persona_numeroDocumento,
        p.first_name AS persona_primerNombre, p.last_name AS persona_primerApellido,
        CONCAT(p.first_name, ' ', p.last_name) AS persona_nombre, p.email AS persona_email,
        f.name AS facultad_nombre, f.code AS facultad_codigo
      FROM teachers t
      INNER JOIN persons p ON t.person_id = p.id
      INNER JOIN faculties f ON t.faculty_id = f.id
      WHERE ${queryField} = ? AND t.deleted_at IS NULL LIMIT 1`,
      [id],
    );

    return rows[0] ? this.formatTeacherRow(rows[0]) : null;
  }

  async findByCodigo(teacherCode, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT 
        t.id, t.uuid, t.person_id AS personaId, t.faculty_id AS facultadId,
        t.user_uuid AS userUuid, t.teacher_code AS codigoDocente,
        t.contract_type AS tipoContrato, t.hire_date AS fechaContratacion,
        t.termination_date AS fechaTerminacion, t.academic_degree AS tituloAcademico,
        t.status AS estado, t.is_active AS activo, t.created_at AS createdAt,
        t.updated_at AS updatedAt,
        p.document_type_code AS persona_tipoDocumento, p.document_number AS persona_numeroDocumento,
        p.first_name AS persona_primerNombre, p.last_name AS persona_primerApellido,
        CONCAT(p.first_name, ' ', p.last_name) AS persona_nombre, p.email AS persona_email,
        f.name AS facultad_nombre, f.code AS facultad_codigo
      FROM teachers t
      INNER JOIN persons p ON t.person_id = p.id
      INNER JOIN faculties f ON t.faculty_id = f.id
      WHERE t.teacher_code = ? AND t.deleted_at IS NULL LIMIT 1`,
      [teacherCode],
    );

    return rows[0] ? this.formatTeacherRow(rows[0]) : null;
  }

  async findByPersonaId(personId, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT 
        t.id, t.uuid, t.person_id AS personaId, t.faculty_id AS facultadId,
        t.user_uuid AS userUuid, t.teacher_code AS codigoDocente,
        t.contract_type AS tipoContrato, t.hire_date AS fechaContratacion,
        t.termination_date AS fechaTerminacion, t.academic_degree AS tituloAcademico,
        t.status AS estado, t.is_active AS activo, t.created_at AS createdAt,
        t.updated_at AS updatedAt,
        p.document_type_code AS persona_tipoDocumento, p.document_number AS persona_numeroDocumento,
        p.first_name AS persona_primerNombre, p.last_name AS persona_primerApellido,
        CONCAT(p.first_name, ' ', p.last_name) AS persona_nombre, p.email AS persona_email,
        f.name AS facultad_nombre, f.code AS facultad_codigo
      FROM teachers t
      INNER JOIN persons p ON t.person_id = p.id
      INNER JOIN faculties f ON t.faculty_id = f.id
      WHERE t.person_id = ? AND t.deleted_at IS NULL LIMIT 1`,
      [personId],
    );

    return rows[0] ? this.formatTeacherRow(rows[0]) : null;
  }

  async update(id, data, conn = null) {
    const executor = conn || this.getPool();
    const existing = await this.findById(id, conn);
    if (!existing) return null;

    const facultyId = keep(data.facultadId, existing.facultadId);
    const userUuid = keep(data.userUuid, existing.userUuid);
    const teacherCode = keep(data.codigoDocente, existing.codigoDocente);
    const contractType = keep(data.tipoContrato, existing.tipoContrato);
    const hireDate = keep(data.fechaContratacion, existing.fechaContratacion);
    const terminationDate = keep(data.fechaTerminacion, existing.fechaTerminacion);
    const academicDegree = keep(data.tituloAcademico, existing.tituloAcademico);
    const status = keep(data.estado, existing.estado);
    let isActive = existing.activo;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    await executor.query(
      `UPDATE teachers 
       SET faculty_id = ?, user_uuid = ?, teacher_code = ?, contract_type = ?,
           hire_date = ?, termination_date = ?, academic_degree = ?, status = ?, is_active = ?
       WHERE id = ?`,
      [
        facultyId,
        userUuid,
        teacherCode,
        contractType,
        hireDate,
        terminationDate,
        academicDegree,
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
      'UPDATE teachers SET is_active = 0, deleted_at = NOW() WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  }

  formatTeacherRow(row) {
    const {
      persona_tipoDocumento: personaTipoDocumento,
      persona_numeroDocumento: personaNumeroDocumento,
      persona_primerNombre: _primerNombre,
      persona_primerApellido: _primerApellido,
      persona_nombre: personaNombre,
      persona_email: personaEmail,
      facultad_nombre: facultadNombre,
      facultad_codigo: facultadCodigo,
      ...teacherData
    } = row;

    teacherData.Tercero = {
      id: teacherData.personaId,
      tipoDocumento: personaTipoDocumento,
      numeroDocumento: personaNumeroDocumento,
      nombre: personaNombre,
      email: personaEmail,
    };
    teacherData.tercero = teacherData.Tercero;

    teacherData.Facultad = {
      id: teacherData.facultadId,
      nombre: facultadNombre,
      codigo: facultadCodigo,
    };
    teacherData.facultad = teacherData.Facultad;

    return teacherData;
  }
}

module.exports = DocenteRepository;
