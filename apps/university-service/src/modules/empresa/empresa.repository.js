const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const keep = (value, fallback) => (value !== undefined ? value : fallback);

class EmpresaRepository {
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
    const legalName = data.razonSocial || data.legal_name || data.nombre;
    const tradeName = data.nombreComercial || data.trade_name || null;
    const taxId = data.nit || data.tax_id;
    const checkDigit = data.digitoVerificacion || data.check_digit || null;
    const address = data.direccion || data.address || null;
    const phone = data.telefono || data.phone || null;
    const email = data.email || null;
    const cityUuid = data.cityUuid || data.city_uuid || null;
    const cityName = data.cityName || data.city_name || null;
    let isActive = 1;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    const result = await executor.query(
      `INSERT INTO companies 
       (uuid, legal_name, trade_name, tax_id, check_digit, address,
        phone, email, city_uuid, city_name, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        legalName,
        tradeName,
        taxId,
        checkDigit,
        address,
        phone,
        email,
        cityUuid,
        cityName,
        isActive,
      ],
    );

    const { insertId } = result;
    return this.findById(insertId, conn);
  }

  async findAll({ page = 1, limit = 20, search } = {}) {
    const pool = this.getPool();
    const offset = (page - 1) * limit;

    let countSql = 'SELECT COUNT(*) AS total FROM companies WHERE is_active = 1';
    let dataSql = `
      SELECT 
        id, uuid, legal_name AS razonSocial, trade_name AS nombreComercial,
        tax_id AS nit, check_digit AS digitoVerificacion, address AS direccion,
        phone AS telefono, email, city_uuid AS cityUuid, city_name AS cityName,
        is_active AS activo, created_at AS createdAt, updated_at AS updatedAt
      FROM companies 
      WHERE is_active = 1
    `;
    const params = [];
    const countParams = [];

    if (search) {
      const searchClause = ' AND (legal_name LIKE ? OR trade_name LIKE ? OR tax_id LIKE ?)';
      countSql += searchClause;
      dataSql += searchClause;
      const term = `%${search}%`;
      countParams.push(term, term, term);
      params.push(term, term, term);
    }

    dataSql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const countResult = await pool.query(countSql, countParams);
    const total = countResult[0]?.total || 0;
    const rows = await pool.query(dataSql, params);

    return {
      data: rows,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async findById(id, conn = null) {
    const executor = conn || this.getPool();
    const isUuid = typeof id === 'string' && id.length === 36;
    const queryField = isUuid ? 'uuid' : 'id';

    const rows = await executor.query(
      `SELECT 
        id, uuid, legal_name AS razonSocial, trade_name AS nombreComercial,
        tax_id AS nit, check_digit AS digitoVerificacion, address AS direccion,
        phone AS telefono, email, city_uuid AS cityUuid, city_name AS cityName,
        is_active AS activo, created_at AS createdAt, updated_at AS updatedAt
      FROM companies 
      WHERE ${queryField} = ? LIMIT 1`,
      [id],
    );

    return rows[0] || null;
  }

  async findByNit(nit, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT 
        id, uuid, legal_name AS razonSocial, trade_name AS nombreComercial,
        tax_id AS nit, check_digit AS digitoVerificacion, address AS direccion,
        phone AS telefono, email, city_uuid AS cityUuid, city_name AS cityName,
        is_active AS activo, created_at AS createdAt, updated_at AS updatedAt
      FROM companies 
      WHERE tax_id = ? LIMIT 1`,
      [nit],
    );

    return rows[0] || null;
  }

  async update(id, data, conn = null) {
    const executor = conn || this.getPool();
    const existing = await this.findById(id, conn);
    if (!existing) return null;

    const legalName = data.razonSocial ?? existing.razonSocial;
    const tradeName = keep(data.nombreComercial, existing.nombreComercial);
    const taxId = data.nit ?? existing.nit;
    const checkDigit = keep(data.digitoVerificacion, existing.digitoVerificacion);
    const address = keep(data.direccion, existing.direccion);
    const phone = keep(data.telefono, existing.telefono);
    const email = keep(data.email, existing.email);
    const cityUuid = keep(data.cityUuid, existing.cityUuid);
    const cityName = keep(data.cityName, existing.cityName);
    let isActive = existing.activo;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    await executor.query(
      `UPDATE companies 
       SET legal_name = ?, trade_name = ?, tax_id = ?, check_digit = ?, address = ?,
           phone = ?, email = ?, city_uuid = ?, city_name = ?, is_active = ?
       WHERE id = ?`,
      [
        legalName,
        tradeName,
        taxId,
        checkDigit,
        address,
        phone,
        email,
        cityUuid,
        cityName,
        isActive,
        existing.id,
      ],
    );

    return this.findById(existing.id, conn);
  }

  async countAssociatedTerceros(empresaId, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      'SELECT COUNT(*) AS total FROM persons WHERE company_id = ? AND is_active = 1',
      [empresaId],
    );
    return rows[0]?.total || 0;
  }

  async delete(id, conn = null) {
    const executor = conn || this.getPool();
    const result = await executor.query('UPDATE companies SET is_active = 0 WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = EmpresaRepository;
