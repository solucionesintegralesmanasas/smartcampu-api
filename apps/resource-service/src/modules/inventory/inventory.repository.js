const { getMysqlPool } = require('../../config/database/mysql');
const { buildSetClause, identifierField, toJsonColumn } = require('../../core/helpers/sql.helper');

const SELECT_ITEM = `SELECT id, uuid, serial_number AS numeroSerie, description AS descripcion,
    quantity AS cantidad, unit AS unidad, condition_code AS condicion,
    DATE_FORMAT(acquired_at, '%Y-%m-%d') AS fechaAdquisicion, attributes AS atributos,
    is_active AS activo, created_at AS createdAt, updated_at AS updatedAt
  FROM inventory_items`;

const ITEM_COLUMNS = Object.freeze({
  numeroSerie: 'serial_number',
  descripcion: 'description',
  cantidad: 'quantity',
  unidad: 'unit',
  condicion: 'condition_code',
  fechaAdquisicion: 'acquired_at',
  atributos: 'attributes',
  activo: 'is_active',
});

const mapItem = (row) => ({ ...row, activo: Boolean(row.activo) });

class InventoryRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async findByResource(resourceId, { limit, offset }) {
    const pool = this.getPool();
    const [countRow] = await pool.query(
      'SELECT COUNT(*) AS total FROM inventory_items WHERE resource_id = ? AND is_active = 1',
      [resourceId],
    );
    const rows = await pool.query(
      `${SELECT_ITEM} WHERE resource_id = ? AND is_active = 1 ORDER BY id ASC LIMIT ? OFFSET ?`,
      [resourceId, limit, offset],
    );
    return { rows: rows.map(mapItem), total: countRow.total };
  }

  async findOne(resourceId, identifier) {
    const [row] = await this.getPool().query(
      `${SELECT_ITEM} WHERE resource_id = ? AND ${identifierField(identifier)} = ? LIMIT 1`,
      [resourceId, identifier],
    );
    return row ? mapItem(row) : null;
  }

  async create(resourceId, dto) {
    const result = await this.getPool().query(
      `INSERT INTO inventory_items
        (resource_id, serial_number, description, quantity, unit, condition_code,
         acquired_at, attributes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        resourceId,
        dto.numeroSerie ?? null,
        dto.descripcion,
        dto.cantidad ?? 1,
        dto.unidad ?? 'unit',
        dto.condicion ?? 'good',
        dto.fechaAdquisicion ?? null,
        toJsonColumn(dto.atributos),
      ],
    );
    return result.insertId;
  }

  async update(id, dto) {
    const payload = { ...dto };
    if ('atributos' in dto) {
      payload.atributos = toJsonColumn(dto.atributos);
    }
    const { clause, params } = buildSetClause(payload, ITEM_COLUMNS);
    if (!clause) return;
    await this.getPool().query(`UPDATE inventory_items SET ${clause} WHERE id = ?`, [...params, id]);
  }

  async softDelete(id) {
    await this.getPool().query('UPDATE inventory_items SET is_active = 0 WHERE id = ?', [id]);
  }
}

module.exports = InventoryRepository;
