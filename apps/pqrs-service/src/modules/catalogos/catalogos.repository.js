const { getMysqlPool } = require('../../config/database/mysql');

/**
 * Acceso de solo lectura a los catálogos de PQRS (tipos y estados).
 */
class CatalogosRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async findTipos() {
    return this.getPool().query(
      `SELECT uuid, code AS codigo, name AS nombre,
              response_days_business AS plazoDias
       FROM pqrs_types
       WHERE is_active = 1
       ORDER BY id ASC`,
    );
  }

  async findEstados() {
    return this.getPool().query(
      `SELECT uuid, code AS codigo, name AS nombre, is_terminal AS esTerminal,
              color_hex AS colorHex
       FROM pqrs_statuses
       WHERE is_active = 1
       ORDER BY id ASC`,
    );
  }
}

module.exports = CatalogosRepository;
