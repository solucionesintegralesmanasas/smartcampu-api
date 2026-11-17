const { getMysqlPool } = require('../../config/database/mysql');

/**
 * Acceso de solo lectura a los catálogos de solicitudes.
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

  async findCategorias() {
    return this.getPool().query(
      `SELECT uuid, code AS codigo, name AS nombre, icon AS icono, sort_order AS orden
       FROM request_categories
       WHERE is_active = 1
       ORDER BY sort_order ASC, id ASC`,
    );
  }

  /**
   * @param {string} [categoriaUuid] - Filtra por categoría activa cuando se indica.
   */
  async findTipos(categoriaUuid) {
    const filtro = categoriaUuid ? 'AND c.uuid = ?' : '';
    return this.getPool().query(
      `SELECT t.uuid, t.code AS codigo, t.name AS nombre, t.description AS descripcion,
              t.requires_approval AS requiereAprobacion, t.sla_days AS slaDias,
              t.cost AS costo, t.form_schema AS formSchema,
              c.uuid AS categoriaUuid, c.code AS categoriaCodigo
       FROM request_types t
       JOIN request_categories c ON c.id = t.category_id
       WHERE t.is_active = 1 AND c.is_active = 1 ${filtro}
       ORDER BY c.sort_order ASC, t.id ASC`,
      categoriaUuid ? [categoriaUuid] : [],
    );
  }

  async findEstados() {
    return this.getPool().query(
      `SELECT uuid, code AS codigo, name AS nombre, is_terminal AS esTerminal,
              color_hex AS colorHex
       FROM request_statuses
       WHERE is_active = 1
       ORDER BY id ASC`,
    );
  }
}

module.exports = CatalogosRepository;
