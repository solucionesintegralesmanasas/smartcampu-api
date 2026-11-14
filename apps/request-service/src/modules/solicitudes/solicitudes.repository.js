const { getMysqlPool } = require('../../config/database/mysql');

const COLUMNAS_SOLICITUD = `
  SELECT r.id, r.uuid, r.ticket_number, r.title, r.description, r.form_data,
         r.requester_uuid, r.requester_name, r.assignee_uuid, r.assignee_name,
         DATE_FORMAT(r.due_date, '%Y-%m-%d') AS due_date,
         r.resolved_at, r.created_at, r.updated_at,
         t.uuid AS tipo_uuid, t.code AS tipo_codigo, t.name AS tipo_nombre,
         t.requires_approval AS requiere_aprobacion,
         s.id AS estado_id, s.code AS estado_codigo, s.name AS estado_nombre,
         s.color_hex AS estado_color`;

const JOINS_SOLICITUD = `
  FROM requests r
  JOIN request_types t ON t.id = r.request_type_id
  JOIN request_statuses s ON s.id = r.status_id`;

/**
 * Acceso a datos de solicitudes. Las escrituras reciben la conexión de la transacción
 * (ver withTransaction) para que la auditoría y el cambio de estado sean atómicos.
 */
class SolicitudesRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  ejecutor(conn) {
    return conn || this.getPool();
  }

  /**
   * Ejecuta un callback dentro de una transacción. Hace commit si termina bien y rollback si falla.
   * @param {(conn: object) => Promise<any>} callback
   * @returns {Promise<any>}
   */
  async withTransaction(callback) {
    const conn = await this.getPool().beginTransaction();
    try {
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async findTipoActivoByUuid(uuid) {
    const rows = await this.getPool().query(
      `SELECT id, uuid, code, name, requires_approval AS requiereAprobacion,
              sla_days AS slaDias
       FROM request_types
       WHERE uuid = ? AND is_active = 1
       LIMIT 1`,
      [uuid],
    );
    return rows[0] || null;
  }

  async findEstadoByCode(code, conn = null) {
    const rows = await this.ejecutor(conn).query(
      `SELECT id, code, name FROM request_statuses WHERE code = ? AND is_active = 1 LIMIT 1`,
      [code],
    );
    return rows[0] || null;
  }

  /**
   * Calcula el siguiente consecutivo del año. El bloqueo FOR UPDATE sobre el rango de tickets
   * del año serializa las creaciones concurrentes dentro de la transacción.
   * @param {string} anio - Año de 4 dígitos.
   * @param {object} conn - Conexión de la transacción.
   * @returns {Promise<number>}
   */
  async siguienteSecuencia(anio, conn) {
    const rows = await conn.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number, 10) AS UNSIGNED)), 0) AS ultimo
       FROM requests
       WHERE ticket_number LIKE ?
       FOR UPDATE`,
      [`REQ-${anio}-%`],
    );
    return Number(rows[0].ultimo) + 1;
  }

  async insertSolicitud(data, conn) {
    const result = await conn.query(
      `INSERT INTO requests (uuid, ticket_number, request_type_id, status_id, requester_uuid,
                             requester_name, title, description, form_data, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.uuid,
        data.numero,
        data.tipoId,
        data.estadoId,
        data.solicitanteUuid,
        data.solicitanteNombre,
        data.titulo,
        data.descripcion,
        data.formData ? JSON.stringify(data.formData) : null,
        data.fechaLimite,
      ],
    );
    return result.insertId;
  }

  async insertAuditoria(data, conn) {
    await conn.query(
      `INSERT INTO request_audit_trail (uuid, request_id, from_status_id, to_status_id,
                                        actor_uuid, actor_name, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.uuid,
        data.solicitudId,
        data.desdeEstadoId,
        data.haciaEstadoId,
        data.actorUuid,
        data.actorNombre,
        data.comentario,
      ],
    );
  }

  /**
   * Actualiza el estado de una solicitud. Fija resolved_at al cerrar y reasigna si se indica asignadoUuid.
   * @param {number} solicitudId
   * @param {{ estadoId: number, cerrar: boolean, asignadoUuid?: string|null }} cambios
   * @param {object} conn
   */
  async updateEstado(solicitudId, cambios, conn) {
    const asignaciones = ['status_id = ?'];
    const params = [cambios.estadoId];
    if (cambios.cerrar) {
      asignaciones.push('resolved_at = NOW()');
    }
    if (cambios.asignadoUuid !== undefined) {
      asignaciones.push('assignee_uuid = ?', 'assignee_name = ?');
      params.push(cambios.asignadoUuid, null);
    }
    await conn.query(`UPDATE requests SET ${asignaciones.join(', ')} WHERE id = ?`, [
      ...params,
      solicitudId,
    ]);
  }

  async insertComentario(data, conn = null) {
    await this.ejecutor(conn).query(
      `INSERT INTO request_comments (uuid, request_id, author_uuid, author_name, body, is_internal)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.uuid,
        data.solicitudId,
        data.autorUuid,
        data.autorNombre,
        data.contenido,
        data.esInterno ? 1 : 0,
      ],
    );
  }

  async insertAdjunto(data, conn = null) {
    await this.ejecutor(conn).query(
      `INSERT INTO request_attachments (uuid, request_id, uploader_uuid, file_uuid,
                                        original_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.uuid,
        data.solicitudId,
        data.subidoPorUuid,
        data.fileUuid,
        data.nombreOriginal,
        data.mimeType,
        data.tamanoBytes,
      ],
    );
  }

  /**
   * Busca una solicitud activa por UUID con su tipo y estado.
   * @param {string} uuid
   * @param {{ conn?: object, bloquear?: boolean }} [opciones] - bloquear aplica FOR UPDATE.
   * @returns {Promise<object|null>}
   */
  async findByUuid(uuid, { conn = null, bloquear = false } = {}) {
    const rows = await this.ejecutor(conn).query(
      `${COLUMNAS_SOLICITUD} ${JOINS_SOLICITUD}
       WHERE r.uuid = ? AND r.is_active = 1
       LIMIT 1${bloquear ? ' FOR UPDATE' : ''}`,
      [uuid],
    );
    return rows[0] || null;
  }

  /**
   * Lista solicitudes con filtros opcionales y paginación.
   * @param {{ page: number, limit: number, offset: number, requesterUuid?: string,
   *   estado?: string, tipoUuid?: string, asignadoUuid?: string }} filtros
   * @returns {Promise<{ rows: object[], total: number }>}
   */
  async findSolicitudes({ limit, offset, requesterUuid, estado, tipoUuid, asignadoUuid }) {
    const condiciones = ['r.is_active = 1'];
    const params = [];
    if (requesterUuid) {
      condiciones.push('r.requester_uuid = ?');
      params.push(requesterUuid);
    }
    if (estado) {
      condiciones.push('s.code = ?');
      params.push(estado);
    }
    if (tipoUuid) {
      condiciones.push('t.uuid = ?');
      params.push(tipoUuid);
    }
    if (asignadoUuid) {
      condiciones.push('r.assignee_uuid = ?');
      params.push(asignadoUuid);
    }
    const where = `WHERE ${condiciones.join(' AND ')}`;

    const pool = this.getPool();
    const [conteo] = await pool.query(`SELECT COUNT(*) AS total ${JOINS_SOLICITUD} ${where}`, params);
    const rows = await pool.query(
      `${COLUMNAS_SOLICITUD} ${JOINS_SOLICITUD} ${where}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return { rows, total: Number(conteo.total) };
  }

  /**
   * Comentarios de una solicitud. Con soloPublicos se excluyen las notas internas.
   * @param {number} solicitudId
   * @param {{ soloPublicos?: boolean }} [opciones]
   */
  async findComentarios(solicitudId, { soloPublicos = false } = {}) {
    return this.getPool().query(
      `SELECT uuid, author_uuid AS autorUuid, author_name AS autorNombre,
              body AS contenido, is_internal AS esInterno, created_at AS creadoEn
       FROM request_comments
       WHERE request_id = ? AND deleted_at IS NULL
             ${soloPublicos ? 'AND is_internal = 0' : ''}
       ORDER BY created_at ASC, id ASC`,
      [solicitudId],
    );
  }

  async findAdjuntos(solicitudId) {
    return this.getPool().query(
      `SELECT uuid, file_uuid AS fileUuid, original_name AS nombreOriginal,
              mime_type AS mimeType, size_bytes AS tamanoBytes,
              uploader_uuid AS subidoPorUuid, uploaded_at AS subidoEn
       FROM request_attachments
       WHERE request_id = ?
       ORDER BY uploaded_at ASC, id ASC`,
      [solicitudId],
    );
  }
}

module.exports = SolicitudesRepository;
