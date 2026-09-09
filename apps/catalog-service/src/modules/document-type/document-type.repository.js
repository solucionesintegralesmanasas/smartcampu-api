const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

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

  async create({ name, code, requiresCheckDigit }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO document_types (name, code, requires_check_digit, is_active) VALUES (?, ?, ?, ?)',
      [name, code ?? null, requiresCheckDigit ? 1 : 0, 1],
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
      'SELECT id, uuid, name, code, requires_check_digit AS requiresCheckDigit, is_active AS active, created_at, updated_at FROM document_types WHERE is_active = ? ORDER BY id DESC LIMIT ? OFFSET ?',
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
      'SELECT id, uuid, name, code, requires_check_digit AS requiresCheckDigit, is_active AS active, created_at, updated_at FROM document_types WHERE id = ? AND is_active = ?',
      [id, 1],
    );
    return rows[0] || null;
  }

  async findByName(name) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT id, uuid, name, code, requires_check_digit AS requiresCheckDigit, is_active AS active, created_at, updated_at FROM document_types WHERE name = ? AND is_active = ?',
      [name, 1],
    );
    return rows[0] || null;
  }

  async findByCode(code) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT id, uuid, name, code, requires_check_digit AS requiresCheckDigit, is_active AS active, created_at, updated_at FROM document_types WHERE code = ? AND is_active = ?',
      [code, 1],
    );
    return rows[0] || null;
  }

  async update(id, { name, code, requiresCheckDigit }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];

    if (name !== undefined) {
      sets.push('name = ?');
      params.push(name);
    }
    if (code !== undefined) {
      sets.push('code = ?');
      params.push(code ?? null);
    }
    if (requiresCheckDigit !== undefined) {
      sets.push('requires_check_digit = ?');
      params.push(requiresCheckDigit ? 1 : 0);
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

  async countAll() {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT COUNT(*) AS total FROM document_types WHERE is_active = ?',
      [1],
    );
    return rows[0].total;
  }
}

module.exports = DocumentTypeRepository;
