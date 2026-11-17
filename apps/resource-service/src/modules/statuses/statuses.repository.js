const { getMysqlPool } = require('../../config/database/mysql');

class StatusesRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async findAllActive() {
    const rows = await this.getPool().query(
      `SELECT id, uuid, code AS codigo, name AS nombre, is_bookable AS reservable,
          color_hex AS colorHex
       FROM resource_statuses
       WHERE is_active = 1
       ORDER BY id ASC`,
    );
    return rows.map((row) => ({ ...row, reservable: Boolean(row.reservable) }));
  }
}

module.exports = StatusesRepository;
