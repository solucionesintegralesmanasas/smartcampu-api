const { getMysqlPool } = require('../../config/database/mysql');

class CatalogoRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async findCategorias() {
    const [rows] = await this.getPool().query(
      `SELECT uuid, code AS codigo, name AS nombre, color_hex AS colorHex, icon AS icono
       FROM event_categories
       WHERE is_active = 1
       ORDER BY id`,
    );
    return rows;
  }

  async findEstados() {
    const [rows] = await this.getPool().query(
      `SELECT uuid, code AS codigo, name AS nombre, is_terminal AS esTerminal
       FROM event_statuses
       WHERE is_active = 1
       ORDER BY id`,
    );
    return rows.map((row) => ({ ...row, esTerminal: Boolean(row.esTerminal) }));
  }

  async findCategoriaByUuid(uuid, conn = null) {
    const executor = conn || this.getPool();
    const [rows] = await executor.query(
      `SELECT id, uuid, code AS codigo, name AS nombre
       FROM event_categories
       WHERE uuid = ? AND is_active = 1
       LIMIT 1`,
      [uuid],
    );
    return rows[0] || null;
  }

  async findEstadoByCodigo(codigo, conn = null) {
    const executor = conn || this.getPool();
    const [rows] = await executor.query(
      `SELECT id, uuid, code AS codigo, name AS nombre
       FROM event_statuses
       WHERE code = ? AND is_active = 1
       LIMIT 1`,
      [codigo],
    );
    return rows[0] || null;
  }
}

module.exports = CatalogoRepository;
