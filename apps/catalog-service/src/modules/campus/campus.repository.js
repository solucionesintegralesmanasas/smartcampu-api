const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../../config/env');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

class CampusRepository {
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
    cityId, name, address, phone,
  }) {
    const pool = await this.getPool();
    const result = await pool.query(
      'INSERT INTO sedes (nombre, direccion, telefono, id_ciudad, activo) VALUES (?, ?, ?, ?, ?)',
      [name, address ?? null, phone ?? null, cityId, 1],
    );
    return this.findById(result.insertId);
  }

  async findAll({ page = 1, limit = 10 } = {}) {
    const pool = await this.getPool();
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) AS total FROM sedes WHERE activo = ?',
      [1],
    );
    const { total } = countResult[0];

    const rows = await pool.query(
      'SELECT id_sede AS id, uuid, nombre AS name, direccion AS address, telefono AS phone, id_ciudad AS cityId, activo AS active, created_at, updated_at FROM sedes WHERE activo = ? ORDER BY id_sede DESC LIMIT ? OFFSET ?',
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
      'SELECT id_sede AS id, uuid, nombre AS name, direccion AS address, telefono AS phone, id_ciudad AS cityId, activo AS active, created_at, updated_at FROM sedes WHERE id_sede = ? AND activo = ?',
      [id, 1],
    );
    return rows[0] || null;
  }

  async findByCityId(cityId) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT id_sede AS id, uuid, nombre AS name, direccion AS address, telefono AS phone, id_ciudad AS cityId, activo AS active, created_at, updated_at FROM sedes WHERE id_ciudad = ? AND activo = ? ORDER BY nombre',
      [cityId, 1],
    );
    return rows;
  }

  async findByName(name) {
    const pool = await this.getPool();
    const rows = await pool.query(
      'SELECT id_sede AS id, uuid, nombre AS name, direccion AS address, telefono AS phone, id_ciudad AS cityId, activo AS active, created_at, updated_at FROM sedes WHERE nombre = ? AND activo = ?',
      [name, 1],
    );
    return rows[0] || null;
  }

  async update(id, {
    cityId, name, address, phone,
  }) {
    const pool = await this.getPool();
    await pool.query(
      'UPDATE sedes SET nombre = ?, direccion = ?, telefono = ?, id_ciudad = ? WHERE id_sede = ?',
      [name, address ?? null, phone ?? null, cityId, id],
    );
    return this.findById(id);
  }

  async delete(id) {
    const pool = await this.getPool();
    const result = await pool.query(
      'UPDATE sedes SET activo = ? WHERE id_sede = ? AND activo = ?',
      [0, id, 1],
    );
    return result.affectedRows > 0;
  }

  async countAll() {
    const pool = await this.getPool();
    const rows = await pool.query('SELECT COUNT(*) AS total FROM sedes WHERE activo = ?', [1]);
    return rows[0].total;
  }
}

module.exports = CampusRepository;
