const { getMysqlPool } = require('../../config/database/mysql');
const { buildSetClause, identifierField } = require('../../core/helpers/sql.helper');

const SELECT_CATEGORY = `SELECT id, uuid, code AS codigo, name AS nombre, icon AS icono,
    description AS descripcion, is_active AS activo, created_at AS createdAt,
    updated_at AS updatedAt
  FROM resource_categories`;

const CATEGORY_COLUMNS = Object.freeze({
  codigo: 'code',
  nombre: 'name',
  icono: 'icon',
  descripcion: 'description',
  activo: 'is_active',
});

const mapCategory = (row) => ({ ...row, activo: Boolean(row.activo) });

class CategoriesRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async findAll({ limit, offset }) {
    const pool = this.getPool();
    const [countRow] = await pool.query(
      'SELECT COUNT(*) AS total FROM resource_categories WHERE is_active = 1',
    );
    const rows = await pool.query(
      `${SELECT_CATEGORY} WHERE is_active = 1 ORDER BY name ASC LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    return { rows: rows.map(mapCategory), total: countRow.total };
  }

  async findOne(identifier) {
    const [row] = await this.getPool().query(
      `${SELECT_CATEGORY} WHERE ${identifierField(identifier)} = ? LIMIT 1`,
      [identifier],
    );
    return row ? mapCategory(row) : null;
  }

  async findConflicts(codigo, nombre) {
    return this.getPool().query('SELECT id FROM resource_categories WHERE code = ? OR name = ?', [
      codigo,
      nombre,
    ]);
  }

  async create(dto) {
    const result = await this.getPool().query(
      `INSERT INTO resource_categories (code, name, icon, description, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [dto.codigo, dto.nombre, dto.icono ?? null, dto.descripcion ?? null, dto.activo === false ? 0 : 1],
    );
    return result.insertId;
  }

  async update(id, dto) {
    const { clause, params } = buildSetClause(dto, CATEGORY_COLUMNS);
    if (!clause) return;
    await this.getPool().query(`UPDATE resource_categories SET ${clause} WHERE id = ?`, [
      ...params,
      id,
    ]);
  }

  async softDelete(id) {
    await this.getPool().query('UPDATE resource_categories SET is_active = 0 WHERE id = ?', [id]);
  }
}

module.exports = CategoriesRepository;
