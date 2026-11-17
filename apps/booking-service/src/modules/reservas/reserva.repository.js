const { getMysqlPool } = require('../../config/database/mysql');

const COLUMNAS_FECHA_PERMITIDAS = ['approved_at', 'completed_at', 'cancelled_at'];

const SELECT_RESERVA = `SELECT b.id, b.uuid, b.reference_number AS referencia,
         bt.code AS tipoCodigo, bt.name AS tipoNombre,
         bs.id AS estadoId, bs.code AS estadoCodigo, bs.name AS estadoNombre,
         bs.color_hex AS estadoColor,
         b.resource_uuid AS recursoUuid, b.resource_name AS recursoNombre,
         b.requester_uuid AS solicitanteUuid, b.requester_name AS solicitanteNombre,
         b.approver_uuid AS aprobadorUuid, b.title AS titulo, b.description AS descripcion,
         DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS fecha,
         TIME_FORMAT(b.start_time, '%H:%i:%s') AS horaInicio,
         TIME_FORMAT(b.end_time, '%H:%i:%s') AS horaFin,
         b.expected_attendees AS asistentesEsperados,
         b.requested_at AS solicitadaEn, b.approved_at AS aprobadaEn,
         b.cancelled_at AS canceladaEn, b.completed_at AS completadaEn,
         b.cancellation_reason AS motivoCancelacion,
         b.created_at AS createdAt, b.updated_at AS updatedAt
       FROM bookings b
       JOIN booking_types bt ON bt.id = b.booking_type_id
       JOIN booking_statuses bs ON bs.id = b.status_id`;

class ReservaRepository {
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
   * Ejecuta el callback dentro de una transacción. Hace commit si termina bien o rollback si lanza.
   * @param {(conn: object) => Promise<any>} callback
   */
  async withTransaction(callback) {
    const conn = await this.getPool().beginTransaction();
    try {
      const resultado = await callback(conn);
      await conn.commit();
      return resultado;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async findByUuid(uuid, executor = null, { bloquear = false } = {}) {
    const rows = await (executor || this.getPool()).query(
      `${SELECT_RESERVA} WHERE b.uuid = ? LIMIT 1${bloquear ? ' FOR UPDATE OF b' : ''}`,
      [uuid],
    );
    return rows[0] || null;
  }

  async findById(id, executor = null) {
    const rows = await (executor || this.getPool()).query(
      `${SELECT_RESERVA} WHERE b.id = ? LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  /**
   * Listado paginado. Los filtros opcionales se combinan con AND.
   */
  async findAll({ page, limit, estado, recursoUuid, solicitanteUuid }) {
    const pool = this.getPool();
    const filtros = [];
    const params = [];

    if (estado) {
      filtros.push('bs.code = ?');
      params.push(estado);
    }
    if (recursoUuid) {
      filtros.push('b.resource_uuid = ?');
      params.push(recursoUuid);
    }
    if (solicitanteUuid) {
      filtros.push('b.requester_uuid = ?');
      params.push(solicitanteUuid);
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

    const conteo = await pool.query(
      `SELECT COUNT(*) AS total
       FROM bookings b
       JOIN booking_statuses bs ON bs.id = b.status_id
       ${where}`,
      params,
    );
    const rows = await pool.query(
      `${SELECT_RESERVA} ${where} ORDER BY b.requested_at DESC, b.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );

    return { rows, total: Number(conteo[0]?.total || 0) };
  }

  /**
   * Reservas que ocupan el recurso en la fecha indicada. Bloquea sus filas (FOR UPDATE)
   * para serializar las reservas concurrentes sobre el mismo recurso.
   */
  async findActivasPorRecursoYFecha(recursoUuid, fecha, estados, conn) {
    return conn.query(
      `${SELECT_RESERVA}
       WHERE b.resource_uuid = ? AND b.booking_date = ? AND bs.code IN (?)
       FOR UPDATE OF b`,
      [recursoUuid, fecha, estados],
    );
  }

  async insert(datos, conn) {
    const resultado = await conn.query(
      `INSERT INTO bookings (
         reference_number, booking_type_id, status_id, resource_uuid, resource_name,
         requester_uuid, requester_name, title, description, booking_date,
         start_time, end_time, expected_attendees
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.referencia,
        datos.tipoId,
        datos.estadoId,
        datos.recursoUuid,
        datos.recursoNombre,
        datos.solicitanteUuid,
        datos.solicitanteNombre,
        datos.titulo,
        datos.descripcion,
        datos.fecha,
        datos.horaInicio,
        datos.horaFin,
        datos.asistentesEsperados,
      ],
    );
    return resultado.insertId;
  }

  /**
   * Actualiza el estado de la reserva y los campos asociados a la transición.
   * @param {number} id
   * @param {object} cambios
   * @param {number} cambios.estadoId
   * @param {string} [cambios.aprobadorUuid]
   * @param {string} [cambios.columnaFecha] - approved_at | completed_at | cancelled_at
   * @param {string|null} [cambios.motivoCancelacion]
   * @param {object} conn
   */
  async updateEstado(id, cambios, conn) {
    const asignaciones = ['status_id = ?'];
    const params = [cambios.estadoId];

    if (cambios.aprobadorUuid) {
      asignaciones.push('approver_uuid = ?');
      params.push(cambios.aprobadorUuid);
    }
    if (cambios.columnaFecha) {
      if (!COLUMNAS_FECHA_PERMITIDAS.includes(cambios.columnaFecha)) {
        throw new Error(`Columna de fecha no permitida: ${cambios.columnaFecha}`);
      }
      asignaciones.push(`${cambios.columnaFecha} = NOW()`);
    }
    if (cambios.motivoCancelacion !== undefined) {
      asignaciones.push('cancellation_reason = ?');
      params.push(cambios.motivoCancelacion);
    }

    params.push(id);
    await conn.query(`UPDATE bookings SET ${asignaciones.join(', ')} WHERE id = ?`, params);
  }

  async insertAuditoria(
    { reservaId, estadoOrigenId, estadoDestinoId, actorUuid, actorNombre, comentario },
    conn,
  ) {
    await conn.query(
      `INSERT INTO booking_audit_trail (
         booking_id, from_status_id, to_status_id, actor_uuid, actor_name, comment
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reservaId, estadoOrigenId, estadoDestinoId, actorUuid, actorNombre, comentario],
    );
  }

  async findAuditTrail(reservaId) {
    return this.getPool().query(
      `SELECT bat.uuid, desde.code AS desdeCodigo, hasta.code AS hastaCodigo,
              bat.actor_uuid AS actorUuid, bat.actor_name AS actorNombre,
              bat.comment AS comentario, bat.occurred_at AS ocurridoEn
       FROM booking_audit_trail bat
       LEFT JOIN booking_statuses desde ON desde.id = bat.from_status_id
       JOIN booking_statuses hasta ON hasta.id = bat.to_status_id
       WHERE bat.booking_id = ?
       ORDER BY bat.id ASC`,
      [reservaId],
    );
  }
}

module.exports = ReservaRepository;
