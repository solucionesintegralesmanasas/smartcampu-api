const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class EmpresaRepository {
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
    return `id, uuid, legal_name AS legalName, trade_name AS tradeName,
            tax_id AS taxId, address, phone, email,
            city_uuid AS cityUuid, city_name AS cityName,
            is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    legalName, tradeName, taxId, address, phone, email, cityUuid, cityName,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO companies (
        legal_name, trade_name, tax_id, address, phone, email, city_uuid, city_name, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        legalName, tradeName ?? null, taxId, address ?? null,
        phone ?? null, email ?? null, cityUuid ?? null, cityName ?? null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) AS total FROM companies WHERE is_active = 1', []);
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM companies WHERE is_active = 1
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM companies WHERE id = ? AND is_active = 1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByTaxId(taxId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM companies WHERE tax_id = ? AND is_active = 1`,
      [taxId],
    );
    return rows[0] || null;
  }

  async update(id, {
    legalName, tradeName, address, phone, email,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (legalName !== undefined) { sets.push('legal_name = ?'); params.push(legalName); }
    if (tradeName !== undefined) { sets.push('trade_name = ?'); params.push(tradeName); }
    if (address !== undefined) { sets.push('address = ?'); params.push(address); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { sets.push('email = ?'); params.push(email); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE companies SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = EmpresaRepository;
