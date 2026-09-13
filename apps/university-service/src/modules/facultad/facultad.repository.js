const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class FacultadRepository {
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
    const campusId = data.campusId || data.campus_id || 1;
    const code = data.codigo || data.code;
    const name = data.nombre || data.name;
    const deanName = data.decano || data.dean_name || null;
    const email = data.email || null;
    let isActive = 1;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    const result = await executor.query(
      `INSERT INTO faculties 
       (uuid, campus_id, code, name, dean_name, email, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid, campusId, code, name, deanName, email, isActive],
    );

    return this.findById(result.insertId, conn);
  }

  async findAll({
    page = 1, limit = 20, search, campusId,
  } = {}) {
    const pool = this.getPool();
    const offset = (page - 1) * limit;

    let countSql = 'SELECT COUNT(*) AS total FROM faculties WHERE is_active = 1';
    let dataSql = `
      SELECT 
        id, uuid, campus_id AS campusId, code AS codigo, name AS nombre,
        dean_name AS decano, email, is_active AS activo, created_at AS createdAt,
        updated_at AS updatedAt
      FROM faculties 
      WHERE is_active = 1
    `;
    const params = [];
    const countParams = [];

    if (search) {
      const clause = ' AND (name LIKE ? OR code LIKE ? OR dean_name LIKE ?)';
      countSql += clause;
      dataSql += clause;
      const term = `%${search}%`;
      countParams.push(term, term, term);
      params.push(term, term, term);
    }

    if (campusId) {
      countSql += ' AND campus_id = ?';
      dataSql += ' AND campus_id = ?';
      countParams.push(campusId);
      params.push(campusId);
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
        id, uuid, campus_id AS campusId, code AS codigo, name AS nombre,
        dean_name AS decano, email, is_active AS activo, created_at AS createdAt,
        updated_at AS updatedAt
      FROM faculties 
      WHERE ${queryField} = ? LIMIT 1`,
      [id],
    );

    return rows[0] || null;
  }

  async findByCodigo(code, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT 
        id, uuid, campus_id AS campusId, code AS codigo, name AS nombre,
        dean_name AS decano, email, is_active AS activo, created_at AS createdAt,
        updated_at AS updatedAt
      FROM faculties 
      WHERE code = ? LIMIT 1`,
      [code],
    );

    return rows[0] || null;
  }

  async findByNombre(name, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      `SELECT 
        id, uuid, campus_id AS campusId, code AS codigo, name AS nombre,
        dean_name AS decano, email, is_active AS activo, created_at AS createdAt,
        updated_at AS updatedAt
      FROM faculties 
      WHERE name = ? LIMIT 1`,
      [name],
    );

    return rows[0] || null;
  }

  async update(id, data, conn = null) {
    const executor = conn || this.getPool();
    const existing = await this.findById(id, conn);
    if (!existing) return null;

    const campusId = data.campusId !== undefined ? data.campusId : existing.campusId;
    const code = data.codigo !== undefined ? data.codigo : existing.codigo;
    const name = data.nombre !== undefined ? data.nombre : existing.nombre;
    const deanName = data.decano !== undefined ? data.decano : existing.decano;
    const email = data.email !== undefined ? data.email : existing.email;
    let isActive = existing.activo;
    if (data.activo !== undefined) {
      isActive = data.activo ? 1 : 0;
    }

    await executor.query(
      `UPDATE faculties 
       SET campus_id = ?, code = ?, name = ?, dean_name = ?, email = ?, is_active = ?
       WHERE id = ?`,
      [campusId, code, name, deanName, email, isActive, existing.id],
    );

    return this.findById(existing.id, conn);
  }

  async countProgramLinks(facultyId, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      'SELECT COUNT(*) AS total FROM programs WHERE faculty_id = ? AND is_active = 1',
      [facultyId],
    );
    return rows[0]?.total || 0;
  }

  async countTeacherLinks(facultyId, conn = null) {
    const executor = conn || this.getPool();
    const rows = await executor.query(
      'SELECT COUNT(*) AS total FROM teachers WHERE faculty_id = ? AND is_active = 1',
      [facultyId],
    );
    return rows[0]?.total || 0;
  }

  async delete(id, conn = null) {
    const executor = conn || this.getPool();
    const result = await executor.query('UPDATE faculties SET is_active = 0 WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = FacultadRepository;
