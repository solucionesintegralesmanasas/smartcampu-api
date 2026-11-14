const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const SELECT_FIELDS = `id, uuid, code, name,
  requires_check_digit AS requiresCheckDigit,
  applies_to_natural_person AS appliesToNaturalPerson,
  applies_to_legal_entity AS appliesToLegalEntity,
  is_active AS active, created_at, updated_at`;

const toBit = (value, fallback) => ((value === undefined ? fallback : value) ? 1 : 0);

class DocumentTypeRepository {
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

  async create({
    code, name, requiresCheckDigit, appliesToNaturalPerson, appliesToLegalEntity,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO document_types (
        code, name, requires_check_digit, applies_to_natural_person,
        applies_to_legal_entity, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        code,
        name,
        toBit(requiresCheckDigit, false),
        toBit(appliesToNaturalPerson, true),
        toBit(appliesToLegalEntity, false),
        1,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM document_types WHERE is_active = ?',
      [1],
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM document_types WHERE is_active = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [1, limit, offset],
    );

    return {
      data: rows,
      pagination: getPaginationMeta(page, limit, total),
    };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM document_types WHERE id = ? AND is_active = ?`,
      [id, 1],
    );
    return rows[0] || null;
  }

  async findByName(name) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM document_types WHERE name = ? AND is_active = ?`,
      [name, 1],
    );
    return rows[0] || null;
  }

  async findByCode(code) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM document_types WHERE code = ? AND is_active = ?`,
      [code, 1],
    );
    return rows[0] || null;
  }

  async update(id, dto) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];

    if (dto.name !== undefined) {
      sets.push('name = ?');
      params.push(dto.name);
    }
    if (dto.code !== undefined) {
      sets.push('code = ?');
      params.push(dto.code);
    }
    if (dto.requiresCheckDigit !== undefined) {
      sets.push('requires_check_digit = ?');
      params.push(toBit(dto.requiresCheckDigit, false));
    }
    if (dto.appliesToNaturalPerson !== undefined) {
      sets.push('applies_to_natural_person = ?');
      params.push(toBit(dto.appliesToNaturalPerson, true));
    }
    if (dto.appliesToLegalEntity !== undefined) {
      sets.push('applies_to_legal_entity = ?');
      params.push(toBit(dto.appliesToLegalEntity, false));
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE document_types SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE document_types SET is_active = ? WHERE id = ? AND is_active = ?',
      [0, id, 1],
    );
    return result.affectedRows > 0;
  }

  async search(term) {
    const pool = await this.getPool();
    const pattern = `%${term}%`;
    const rows = await pool.query(
      `SELECT ${SELECT_FIELDS} FROM document_types
       WHERE is_active = ? AND (name LIKE ? OR code LIKE ?)
       ORDER BY name ASC LIMIT 50`,
      [1, pattern, pattern],
    );
    return rows;
  }
}

module.exports = DocumentTypeRepository;
