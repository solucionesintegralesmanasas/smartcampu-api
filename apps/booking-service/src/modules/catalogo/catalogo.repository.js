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

  async listTipos() {
    const rows = await this.getPool().query(
      `SELECT uuid, code AS codigo, name AS nombre, description AS descripcion,
              requires_approval AS requiereAprobacion,
              max_duration_minutes AS duracionMaximaMinutos,
              advance_days_limit AS antelacionMaximaDias
       FROM booking_types
       WHERE is_active = 1
       ORDER BY id`,
    );
    return rows.map((row) => ({ ...row, requiereAprobacion: Boolean(row.requiereAprobacion) }));
  }

  async listEstados() {
    const rows = await this.getPool().query(
      `SELECT uuid, code AS codigo, name AS nombre, is_terminal AS esTerminal,
              color_hex AS colorHex
       FROM booking_statuses
       WHERE is_active = 1
       ORDER BY id`,
    );
    return rows.map((row) => ({ ...row, esTerminal: Boolean(row.esTerminal) }));
  }

  async findTipoByCodigo(codigo, executor = null) {
    const rows = await (executor || this.getPool()).query(
      `SELECT id, code AS codigo, name AS nombre,
              max_duration_minutes AS maxDuracionMinutos,
              advance_days_limit AS antelacionMaximaDias,
              is_active AS activo
       FROM booking_types
       WHERE code = ?
       LIMIT 1`,
      [codigo],
    );
    const tipo = rows[0];
    return tipo ? { ...tipo, activo: Boolean(tipo.activo) } : null;
  }

  async findEstadoByCodigo(codigo, executor = null) {
    const rows = await (executor || this.getPool()).query(
      'SELECT id, code AS codigo FROM booking_statuses WHERE code = ? LIMIT 1',
      [codigo],
    );
    return rows[0] || null;
  }
}

module.exports = CatalogoRepository;
