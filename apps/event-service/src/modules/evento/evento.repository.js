const { randomUUID } = require('node:crypto');

const { getMysqlPool } = require('../../config/database/mysql');
const { runInTransaction } = require('../../core/helpers/transaction.helper');

const SELECT_EVENTO = `
  SELECT e.id, e.uuid, e.title AS titulo, e.description AS descripcion,
         e.venue AS lugar, e.starts_at AS fechaInicio, e.ends_at AS fechaFin,
         e.max_capacity AS capacidadMaxima, e.cost AS costo,
         e.requires_registration AS requiereInscripcion,
         e.registration_deadline AS fechaLimiteInscripcion,
         e.cover_image_uuid AS portadaUuid,
         e.organizer_uuid AS organizadorUuid, e.organizer_name AS organizadorNombre,
         e.campus_uuid AS sedeUuid, e.campus_name AS sedeNombre,
         e.created_at AS createdAt, e.updated_at AS updatedAt,
         c.id AS categoriaId, c.uuid AS categoriaUuid, c.code AS categoriaCodigo,
         c.name AS categoriaNombre, c.color_hex AS categoriaColor, c.icon AS categoriaIcono,
         s.id AS estadoId, s.code AS estado, s.name AS estadoNombre
  FROM events e
  INNER JOIN event_categories c ON c.id = e.category_id
  INNER JOIN event_statuses s ON s.id = e.status_id`;

/** Mapa de campos internos a columnas de la tabla events. */
const COLUMNAS_EVENTO = Object.freeze({
  categoriaId: 'category_id',
  sedeUuid: 'campus_uuid',
  sedeNombre: 'campus_name',
  titulo: 'title',
  descripcion: 'description',
  lugar: 'venue',
  fechaInicio: 'starts_at',
  fechaFin: 'ends_at',
  capacidadMaxima: 'max_capacity',
  costo: 'cost',
  requiereInscripcion: 'requires_registration',
  fechaLimiteInscripcion: 'registration_deadline',
});

class EventoRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  withTransaction(callback) {
    return runInTransaction(this.getPool(), callback);
  }

  /**
   * Lista eventos activos con filtros opcionales.
   * @param {Object} filtros
   * @param {string[]|null} filtros.estados - Códigos de estado permitidos (null = todos).
   * @returns {Promise<{rows: Object[], total: number}>}
   */
  async findAll({ estados = null, categoriaUuid, fechaDesde, fechaHasta, page, limit }) {
    const pool = this.getPool();
    const condiciones = ['e.is_active = 1'];
    const params = [];

    if (estados) {
      condiciones.push('s.code IN (?)');
      params.push(estados);
    }
    if (categoriaUuid) {
      condiciones.push('c.uuid = ?');
      params.push(categoriaUuid);
    }
    if (fechaDesde) {
      condiciones.push('e.starts_at >= ?');
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      condiciones.push('e.starts_at <= ?');
      params.push(fechaHasta);
    }

    const where = `WHERE ${condiciones.join(' AND ')}`;
    const joins = `FROM events e
      INNER JOIN event_categories c ON c.id = e.category_id
      INNER JOIN event_statuses s ON s.id = e.status_id`;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total ${joins} ${where}`,
      params,
    );
    const [rows] = await pool.query(
      `${SELECT_EVENTO} ${where} ORDER BY e.starts_at ASC, e.id ASC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );

    return { rows, total };
  }

  /**
   * Busca un evento activo por UUID.
   * @param {string} uuid
   * @param {{conn?: Object, lock?: boolean}} [opciones] - `lock` bloquea la fila (FOR UPDATE).
   * @returns {Promise<Object|null>}
   */
  async findByUuid(uuid, { conn = null, lock = false } = {}) {
    const executor = conn || this.getPool();
    if (lock) {
      await executor.query(
        'SELECT id FROM events WHERE uuid = ? AND is_active = 1 FOR UPDATE',
        [uuid],
      );
    }
    const [rows] = await executor.query(
      `${SELECT_EVENTO} WHERE e.uuid = ? AND e.is_active = 1 LIMIT 1`,
      [uuid],
    );
    return rows[0] || null;
  }

  /**
   * Inserta un evento y devuelve su UUID.
   * @param {Object} datos - Campos internos (categoriaId, estadoId, organizadorUuid, ...).
   * @param {Object} conn - Conexión transaccional.
   * @returns {Promise<string>} UUID generado.
   */
  async insert(datos, conn = null) {
    const executor = conn || this.getPool();
    const uuid = randomUUID();
    await executor.query(
      `INSERT INTO events
        (uuid, category_id, status_id, organizer_uuid, organizer_name, campus_uuid, campus_name,
         title, description, venue, starts_at, ends_at, max_capacity, cost,
         requires_registration, registration_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        datos.categoriaId,
        datos.estadoId,
        datos.organizadorUuid,
        datos.organizadorNombre,
        datos.sedeUuid,
        datos.sedeNombre,
        datos.titulo,
        datos.descripcion ?? null,
        datos.lugar ?? null,
        datos.fechaInicio,
        datos.fechaFin,
        datos.capacidadMaxima ?? null,
        datos.costo ?? 0,
        datos.requiereInscripcion ? 1 : 0,
        datos.fechaLimiteInscripcion ?? null,
      ],
    );
    return uuid;
  }

  /**
   * Actualiza solo los campos presentes en `datos` (valores undefined se omiten).
   */
  async update(id, datos, conn = null) {
    const executor = conn || this.getPool();
    const entradas = Object.entries(datos).filter(
      ([campo, valor]) => COLUMNAS_EVENTO[campo] && valor !== undefined,
    );
    if (entradas.length === 0) return;

    const asignaciones = entradas.map(([campo]) => `${COLUMNAS_EVENTO[campo]} = ?`).join(', ');
    const valores = entradas.map(([campo, valor]) => {
      if (campo === 'requiereInscripcion') return valor ? 1 : 0;
      return valor;
    });
    await executor.query(`UPDATE events SET ${asignaciones} WHERE id = ?`, [...valores, id]);
  }

  async updateEstado(id, estadoId, conn = null) {
    const executor = conn || this.getPool();
    await executor.query('UPDATE events SET status_id = ? WHERE id = ?', [estadoId, id]);
  }

  /** Eliminación lógica: marca el evento como inactivo. */
  async softDelete(id, conn = null) {
    const executor = conn || this.getPool();
    await executor.query('UPDATE events SET is_active = 0 WHERE id = ?', [id]);
  }
}

module.exports = EventoRepository;
