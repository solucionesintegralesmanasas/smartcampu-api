const { getMysqlPool } = require('../../config/database/mysql');
const { buildSetClause, identifierField, toJsonColumn } = require('../../core/helpers/sql.helper');

const SELECT_RESOURCE = `SELECT r.id, r.uuid,
    r.category_id AS categoriaId, c.code AS categoriaCodigo, c.name AS categoriaNombre,
    r.status_id AS estadoId, s.code AS estadoCodigo, s.name AS estadoNombre,
    s.is_bookable AS estadoReservable,
    r.campus_uuid AS campusUuid, r.campus_name AS campusNombre,
    r.code AS codigo, r.name AS nombre, r.description AS descripcion,
    r.capacity AS capacidad, r.floor AS piso, r.building AS edificio,
    r.has_inventory AS tieneInventario, r.attributes AS atributos,
    r.is_active AS activo, r.created_at AS createdAt, r.updated_at AS updatedAt
  FROM resources r
  INNER JOIN resource_categories c ON c.id = r.category_id
  INNER JOIN resource_statuses s ON s.id = r.status_id`;

const RESOURCE_COLUMNS = Object.freeze({
  categoriaId: 'category_id',
  estadoId: 'status_id',
  campusUuid: 'campus_uuid',
  campusNombre: 'campus_name',
  codigo: 'code',
  nombre: 'name',
  descripcion: 'description',
  capacidad: 'capacity',
  piso: 'floor',
  edificio: 'building',
  tieneInventario: 'has_inventory',
  atributos: 'attributes',
  activo: 'is_active',
});

const mapResource = (row) => ({
  ...row,
  estadoReservable: Boolean(row.estadoReservable),
  tieneInventario: Boolean(row.tieneInventario),
  activo: Boolean(row.activo),
});

class ResourcesRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  /**
   * Lista recursos activos con filtros opcionales.
   */
  async findAll({
    limit, offset, search, categoriaId, estadoId,
  }) {
    const conditions = ['r.is_active = 1'];
    const params = [];

    if (search) {
      conditions.push('r.name LIKE ?');
      params.push(`%${search}%`);
    }
    if (categoriaId) {
      conditions.push('r.category_id = ?');
      params.push(categoriaId);
    }
    if (estadoId) {
      conditions.push('r.status_id = ?');
      params.push(estadoId);
    }

    const where = conditions.join(' AND ');
    const pool = this.getPool();
    const [countRow] = await pool.query(
      `SELECT COUNT(*) AS total FROM resources r WHERE ${where}`,
      params,
    );
    const rows = await pool.query(
      `${SELECT_RESOURCE} WHERE ${where} ORDER BY r.name ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return { rows: rows.map(mapResource), total: countRow.total };
  }

  /**
   * Busca por id interno o uuid. Devuelve también los inactivos (uso administrativo).
   */
  async findOne(identifier) {
    const [row] = await this.getPool().query(
      `${SELECT_RESOURCE} WHERE r.${identifierField(identifier)} = ? LIMIT 1`,
      [identifier],
    );
    return row ? mapResource(row) : null;
  }

  async create(dto) {
    const result = await this.getPool().query(
      `INSERT INTO resources
        (category_id, status_id, campus_uuid, campus_name, code, name, description,
         capacity, floor, building, has_inventory, attributes, is_active)
       VALUES (?, COALESCE(?, (SELECT id FROM resource_statuses WHERE code = 'available' LIMIT 1)),
               ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        dto.categoriaId,
        dto.estadoId ?? null,
        dto.campusUuid,
        dto.campusNombre,
        dto.codigo,
        dto.nombre,
        dto.descripcion ?? null,
        dto.capacidad ?? null,
        dto.piso ?? null,
        dto.edificio ?? null,
        dto.tieneInventario ? 1 : 0,
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
    const { clause, params } = buildSetClause(payload, RESOURCE_COLUMNS);
    if (!clause) return;
    await this.getPool().query(`UPDATE resources SET ${clause} WHERE id = ?`, [...params, id]);
  }

  async softDelete(id) {
    await this.getPool().query('UPDATE resources SET is_active = 0 WHERE id = ?', [id]);
  }
}

module.exports = ResourcesRepository;
