const { getMysqlPool } = require('../../config/database/mysql');

const COLUMNAS_PQRS = `
  SELECT p.id, p.uuid, p.ticket_number, p.is_anonymous, p.requester_uuid, p.requester_name,
         p.requester_email, p.assignee_uuid, p.assignee_name, p.subject, p.description,
         p.filed_at, DATE_FORMAT(p.response_due_date, '%Y-%m-%d') AS response_due_date,
         p.responded_at, p.closed_at, p.satisfaction_score, p.created_at, p.updated_at,
         t.uuid AS tipo_uuid, t.code AS tipo_codigo, t.name AS tipo_nombre,
         t.response_days_business AS tipo_plazo_dias,
         s.id AS estado_id, s.code AS estado_codigo, s.name AS estado_nombre,
         s.color_hex AS estado_color, s.is_terminal AS estado_terminal`;

const JOINS_PQRS = `
  FROM pqrs p
  JOIN pqrs_types t ON t.id = p.type_id
  JOIN pqrs_statuses s ON s.id = p.status_id`;

/**
 * Acceso a datos de PQRS. Las escrituras reciben la conexión de la transacción
 * para que la auditoría y el cambio de estado sean atómicos.
 */
class PqrsRepository {
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

  async findTipoByCode(code) {
    const rows = await this.getPool().query(
      `SELECT id, uuid, code, name, response_days_business AS plazoDias
       FROM pqrs_types WHERE code = ? AND is_active = 1 LIMIT 1`,
      [code],
    );
    return rows[0] || null;
  }

  async findEstadoByCode(code, conn = null) {
    const rows = await this.ejecutor(conn).query(
      `SELECT id, code, name FROM pqrs_statuses WHERE code = ? AND is_active = 1 LIMIT 1`,
      [code],
    );
    return rows[0] || null;
  }

  /**
   * Calcula el siguiente consecutivo del año. El bloqueo FOR UPDATE sobre el rango
   * de radicados del año serializa las creaciones concurrentes dentro de la transacción.
   * @param {string} anio - Año de 4 dígitos.
   * @param {object} conn - Conexión de la transacción.
   * @returns {Promise<number>}
   */
  async siguienteSecuencia(anio, conn) {
    const rows = await conn.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number, 11) AS UNSIGNED)), 0) AS ultimo
       FROM pqrs
       WHERE ticket_number LIKE ?
       FOR UPDATE`,
      [`PQRS-${anio}-%`],
    );
    return Number(rows[0].ultimo) + 1;
  }

  async insertPqrs(data, conn) {
    const result = await conn.query(
      `INSERT INTO pqrs (uuid, ticket_number, type_id, status_id, is_anonymous, requester_uuid,
                         requester_name, requester_email, subject, description, response_due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.uuid,
        data.numero,
        data.tipoId,
        data.estadoId,
        data.esAnonima ? 1 : 0,
        data.solicitanteUuid,
        data.solicitanteNombre,
        data.solicitanteEmail,
        data.asunto,
        data.descripcion,
        data.fechaLimite,
      ],
    );
    return result.insertId;
  }

  async insertAuditoria(data, conn) {
    await conn.query(
      `INSERT INTO pqrs_audit_trail (uuid, pqrs_id, from_status_id, to_status_id,
                                     actor_uuid, actor_name, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.uuid,
        data.pqrsId,
        data.desdeEstadoId,
        data.haciaEstadoId,
        data.actorUuid,
        data.actorNombre,
        data.comentario,
      ],
    );
  }

  async insertRespuesta(data, conn = null) {
    const result = await this.ejecutor(conn).query(
      `INSERT INTO pqrs_responses (uuid, pqrs_id, responder_uuid, responder_name, body, is_final)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.uuid,
        data.pqrsId,
        data.respondedorUuid,
        data.respondedorNombre,
        data.cuerpo,
        data.esFinal ? 1 : 0,
      ],
    );
    return result.insertId;
  }

  async updateAsignacion(pqrsId, { asignadoUuid, asignadoNombre }, conn) {
    await conn.query(
      `UPDATE pqrs SET assignee_uuid = ?, assignee_name = ? WHERE id = ?`,
      [asignadoUuid, asignadoNombre, pqrsId],
    );
  }

  /**
   * Cambia el estado. Marca responded_at o closed_at según corresponda.
   * @param {number} pqrsId
   * @param {{ estadoId: number, responder?: boolean, cerrar?: boolean }} cambios
   * @param {object} conn
   */
  async updateEstado(pqrsId, cambios, conn) {
    const asignaciones = ['status_id = ?'];
    const params = [cambios.estadoId];
    if (cambios.responder) {
      asignaciones.push('responded_at = COALESCE(responded_at, NOW())');
    }
    if (cambios.cerrar) {
      asignaciones.push('closed_at = NOW()');
    }
    await conn.query(`UPDATE pqrs SET ${asignaciones.join(', ')} WHERE id = ?`, [
      ...params,
      pqrsId,
    ]);
  }

  async updateCalificacion(pqrsId, puntaje, conn = null) {
    await this.ejecutor(conn).query('UPDATE pqrs SET satisfaction_score = ? WHERE id = ?', [
      puntaje,
      pqrsId,
    ]);
  }

  /**
   * Busca una PQRS activa por UUID con su tipo y estado.
   * @param {string} uuid
   * @param {{ conn?: object, bloquear?: boolean }} [opciones] - bloquear aplica FOR UPDATE.
   * @returns {Promise<object|null>}
   */
  async findByUuid(uuid, { conn = null, bloquear = false } = {}) {
    const rows = await this.ejecutor(conn).query(
      `${COLUMNAS_PQRS} ${JOINS_PQRS}
       WHERE p.uuid = ? AND p.is_active = 1
       LIMIT 1${bloquear ? ' FOR UPDATE' : ''}`,
      [uuid],
    );
    return rows[0] || null;
  }

  async findByTicket(ticketNumber) {
    const rows = await this.getPool().query(
      `${COLUMNAS_PQRS} ${JOINS_PQRS}
       WHERE p.ticket_number = ? AND p.is_active = 1
       LIMIT 1`,
      [ticketNumber],
    );
    return rows[0] || null;
  }

  /**
   * Lista PQRS con filtros opcionales y paginación.
   * @param {{ limit: number, offset: number, requesterUuid?: string, estado?: string,
   *   tipoCodigo?: string, vencidas?: boolean }} filtros
   * @returns {Promise<{ rows: object[], total: number }>}
   */
  async findPqrs({ limit, offset, requesterUuid, estado, tipoCodigo, vencidas }) {
    const condiciones = ['p.is_active = 1'];
    const params = [];
    if (requesterUuid) {
      condiciones.push('p.requester_uuid = ?');
      params.push(requesterUuid);
    }
    if (estado) {
      condiciones.push('s.code = ?');
      params.push(estado);
    }
    if (tipoCodigo) {
      condiciones.push('t.code = ?');
      params.push(tipoCodigo);
    }
    if (vencidas) {
      condiciones.push("p.response_due_date < CURDATE() AND s.is_terminal = 0");
    }
    const where = `WHERE ${condiciones.join(' AND ')}`;

    const pool = this.getPool();
    const [conteo] = await pool.query(`SELECT COUNT(*) AS total ${JOINS_PQRS} ${where}`, params);
    const rows = await pool.query(
      `${COLUMNAS_PQRS} ${JOINS_PQRS} ${where}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return { rows, total: Number(conteo.total) };
  }

  async findRespuestas(pqrsId) {
    return this.getPool().query(
      `SELECT uuid, responder_uuid AS respondedorUuid, responder_name AS respondedorNombre,
              body AS cuerpo, is_final AS esFinal, created_at AS creadaEn
       FROM pqrs_responses
       WHERE pqrs_id = ?
       ORDER BY created_at ASC, id ASC`,
      [pqrsId],
    );
  }
}

module.exports = PqrsRepository;
