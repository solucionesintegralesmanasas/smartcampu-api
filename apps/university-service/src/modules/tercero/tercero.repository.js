const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const PERSON_SELECT_FIELDS = `
  p.id, p.uuid, p.document_type_code AS tipoDocumento,
  p.document_number AS numeroDocumento, p.check_digit AS digitoVerificacion,
  p.first_name AS primerNombre, p.middle_name AS segundoNombre,
  p.last_name AS primerApellido, p.second_last_name AS segundoApellido,
  CONCAT(p.first_name, ' ', IFNULL(p.middle_name, ''), ' ',
         p.last_name, ' ', IFNULL(p.second_last_name, '')) AS nombre,
  p.date_of_birth AS fechaNacimiento, p.gender AS genero, p.email,
  p.phone AS telefono, p.address AS direccion, p.city_uuid AS cityUuid,
  p.city_name AS cityName, p.company_id AS empresaId, p.is_active AS activo,
  p.created_at AS createdAt, p.updated_at AS updatedAt,
  c.id AS empresa_id, c.legal_name AS empresa_nombre, c.tax_id AS empresa_nit
`;

const keep = (value, fallback) => (value !== undefined ? value : fallback);

class TerceroRepository {
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
    const docType = data.tipoDocumento || data.document_type_code;
    const docNumber = data.numeroDocumento || data.document_number;
    const checkDigit = data.digitoVerificacion || data.check_digit || null;
    const firstName = data.primerNombre || data.first_name;
    const middleName = data.segundoNombre || data.middle_name || null;
    const lastName = data.primerApellido || data.last_name;
    const secondLastName = data.segundoApellido || data.second_last_name || null;
    const dateOfBirth = data.fechaNacimiento || data.date_of_birth || null;
    const gender = data.genero || data.gender || null;
    const email = data.email || null;
    const phone = data.telefono || data.phone || null;
    const address = data.direccion || data.address || null;
    const cityUuid = data.cityUuid || data.city_uuid || null;
    const cityName = data.cityName || data.city_name || null;
    const companyId = data.empresaId || data.company_id || null;
    let isActive = 1;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    const result = await executor.query(
      `INSERT INTO persons 
       (uuid, document_type_code, document_number, check_digit, first_name, middle_name,
        last_name, second_last_name, date_of_birth, gender, email, phone, address,
        city_uuid, city_name, company_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        docType,
        docNumber,
        checkDigit,
        firstName,
        middleName,
        lastName,
        secondLastName,
        dateOfBirth,
        gender,
        email,
        phone,
        address,
        cityUuid,
        cityName,
        companyId,
        isActive,
      ],
    );

    return this.findById(result.insertId, conn);
  }

  async findAll({
    page = 1, limit = 20, search, tipoDocumento, empresaId,
  } = {}) {
    const pool = this.getPool();
    const offset = (page - 1) * limit;

    let countSql = `
      SELECT COUNT(*) AS total 
      FROM persons p 
      WHERE p.is_active = 1 AND p.deleted_at IS NULL
    `;
    let dataSql = `
      SELECT ${PERSON_SELECT_FIELDS}
      FROM persons p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.is_active = 1 AND p.deleted_at IS NULL
    `;
    const params = [];
    const countParams = [];

    if (search) {
      const clause = ` AND (p.first_name LIKE ? OR p.last_name LIKE ? 
        OR p.document_number LIKE ? OR p.email LIKE ?)`;
      countSql += clause;
      dataSql += clause;
      const term = `%${search}%`;
      countParams.push(term, term, term, term);
      params.push(term, term, term, term);
    }

    if (tipoDocumento) {
      countSql += ' AND p.document_type_code = ?';
      dataSql += ' AND p.document_type_code = ?';
      countParams.push(tipoDocumento);
      params.push(tipoDocumento);
    }

    if (empresaId) {
      countSql += ' AND p.company_id = ?';
      dataSql += ' AND p.company_id = ?';
      countParams.push(empresaId);
      params.push(empresaId);
    }

    dataSql += ' ORDER BY p.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const countResult = await pool.query(countSql, countParams);
    const total = countResult[0]?.total || 0;
    const rows = await pool.query(dataSql, params);

    const formatted = rows.map((r) => this.formatPersonRow(r));

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
      `SELECT ${PERSON_SELECT_FIELDS}
      FROM persons p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE ${queryField} = ? AND p.deleted_at IS NULL LIMIT 1`,
      [id],
    );

    return rows[0] ? this.formatPersonRow(rows[0]) : null;
  }

  async findByDocumento(tipoDocumento, numeroDocumento, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT ${PERSON_SELECT_FIELDS}
      FROM persons p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.document_type_code = ? AND p.document_number = ? AND p.deleted_at IS NULL LIMIT 1`,
      [tipoDocumento, numeroDocumento],
    );

    return rows[0] ? this.formatPersonRow(rows[0]) : null;
  }

  async update(id, data, conn = null) {
    const executor = conn || this.getPool();
    const existing = await this.findById(id, conn);
    if (!existing) return null;

    const docType = data.tipoDocumento ?? existing.tipoDocumento;
    const docNumber = data.numeroDocumento ?? existing.numeroDocumento;
    const checkDigit = keep(data.digitoVerificacion, existing.digitoVerificacion);
    const firstName = data.primerNombre ?? existing.primerNombre;
    const middleName = keep(data.segundoNombre, existing.segundoNombre);
    const lastName = data.primerApellido ?? existing.primerApellido;
    const secondLastName = keep(data.segundoApellido, existing.segundoApellido);
    const dateOfBirth = keep(data.fechaNacimiento, existing.fechaNacimiento);
    const gender = keep(data.genero, existing.genero);
    const email = keep(data.email, existing.email);
    const phone = keep(data.telefono, existing.telefono);
    const address = keep(data.direccion, existing.direccion);
    const cityUuid = keep(data.cityUuid, existing.cityUuid);
    const cityName = keep(data.cityName, existing.cityName);
    const companyId = keep(data.empresaId, existing.empresaId);
    let isActive = existing.activo;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    await executor.query(
      `UPDATE persons 
       SET document_type_code = ?, document_number = ?, check_digit = ?, first_name = ?,
           middle_name = ?, last_name = ?, second_last_name = ?, date_of_birth = ?,
           gender = ?, email = ?, phone = ?, address = ?, city_uuid = ?, city_name = ?,
           company_id = ?, is_active = ?
       WHERE id = ?`,
      [
        docType,
        docNumber,
        checkDigit,
        firstName,
        middleName,
        lastName,
        secondLastName,
        dateOfBirth,
        gender,
        email,
        phone,
        address,
        cityUuid,
        cityName,
        companyId,
        isActive,
        existing.id,
      ],
    );

    return this.findById(existing.id, conn);
  }

  async countStudentLinks(personId, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      'SELECT COUNT(*) AS total FROM students WHERE person_id = ? AND is_active = 1',
      [personId],
    );
    return rows[0]?.total || 0;
  }

  async countTeacherLinks(personId, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      'SELECT COUNT(*) AS total FROM teachers WHERE person_id = ? AND is_active = 1',
      [personId],
    );
    return rows[0]?.total || 0;
  }

  async delete(id, conn = null) {
    const executor = conn || this.getPool();
    const result = await executor.query(
      'UPDATE persons SET is_active = 0, deleted_at = NOW() WHERE id = ?',
      [id],
    );
    return result.affectedRows > 0;
  }

  formatPersonRow(row) {
    const {
      empresa_id: empresaId,
      empresa_nombre: empresaNombre,
      empresa_nit: empresaNit,
      ...personData
    } = row;

    personData.nombre = (personData.nombre || '').replace(/\s+/g, ' ').trim();

    if (empresaId) {
      personData.Empresa = {
        id: empresaId,
        nombre: empresaNombre,
        nit: empresaNit,
      };
      personData.empresa = personData.Empresa;
    } else {
      personData.Empresa = null;
      personData.empresa = null;
    }

    return personData;
  }
}

module.exports = TerceroRepository;
