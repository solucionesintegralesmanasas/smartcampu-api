const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class TerceroRepository {
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
    return `id, uuid, document_type_code AS documentTypeCode, document_number AS documentNumber,
            first_name AS firstName, middle_name AS middleName,
            last_name AS lastName, second_last_name AS secondLastName,
            date_of_birth AS dateOfBirth, gender, email, phone, address,
            city_uuid AS cityUuid, city_name AS cityName,
            is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt`;
  }

  async create({
    documentTypeCode, documentNumber, firstName, middleName, lastName, secondLastName,
    dateOfBirth, gender, email, phone, address, cityUuid, cityName,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      `INSERT INTO persons (
        uuid, document_type_code, document_number, first_name, middle_name,
        last_name, second_last_name, date_of_birth, gender, email, phone,
        address, city_uuid, city_name, is_active
      ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        documentTypeCode, documentNumber, firstName, middleName ?? null,
        lastName, secondLastName ?? null, dateOfBirth ?? null, gender ?? null,
        email ?? null, phone ?? null, address ?? null, cityUuid ?? null, cityName ?? null,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM persons WHERE is_active = 1 AND deleted_at IS NULL',
      [],
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      `SELECT ${this.columns()} FROM persons WHERE is_active = 1 AND deleted_at IS NULL
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    return { data: rows, pagination: getPaginationMeta(page, limit, total) };
  }

  async findById(id) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM persons WHERE id = ? AND is_active = 1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] || null;
  }

  async findByDocument(documentTypeCode, documentNumber) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT ${this.columns()} FROM persons
       WHERE document_type_code = ? AND document_number = ?
             AND is_active = 1 AND deleted_at IS NULL`,
      [documentTypeCode, documentNumber],
    );
    return rows[0] || null;
  }

  async update(id, {
    firstName, middleName, lastName, secondLastName, email, phone, address,
  }) {
    const pool = await this.getPool();
    const sets = [];
    const params = [];
    if (firstName !== undefined) { sets.push('first_name = ?'); params.push(firstName); }
    if (middleName !== undefined) { sets.push('middle_name = ?'); params.push(middleName); }
    if (lastName !== undefined) { sets.push('last_name = ?'); params.push(lastName); }
    if (secondLastName !== undefined) { sets.push('second_last_name = ?'); params.push(secondLastName); }
    if (email !== undefined) { sets.push('email = ?'); params.push(email); }
    if (phone !== undefined) { sets.push('phone = ?'); params.push(phone); }
    if (address !== undefined) { sets.push('address = ?'); params.push(address); }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE persons SET ${sets.join(', ')} WHERE id = ?`, params);
    }
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE persons SET is_active = 0 WHERE id = ? AND is_active = 1',
      [id],
    );
    return result.affectedRows > 0;
  }

  async countActiveRoles(personId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM students WHERE person_id = ? AND is_active = 1) +
         (SELECT COUNT(*) FROM teachers WHERE person_id = ? AND is_active = 1) AS total`,
      [personId, personId],
    );
    return rows[0].total;
  }
}

module.exports = TerceroRepository;
