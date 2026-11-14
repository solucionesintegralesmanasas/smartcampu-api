const { randomUUID } = require('node:crypto');

const { getMysqlPool } = require('../../config/database/mysql');
const {
  ESTADOS_INSCRIPCION,
  ESTADOS_QUE_OCUPAN_CUPO,
  ESTADOS_ACTIVOS,
} = require('./inscripcion.constants');

const SELECT_INSCRIPCION = `
  SELECT r.id, r.uuid, r.event_id AS eventId,
         r.registrant_uuid AS registranteUuid, r.registrant_name AS registranteNombre,
         r.status AS estado, r.registered_at AS fechaRegistro,
         r.confirmed_at AS fechaConfirmacion, r.cancelled_at AS fechaCancelacion,
         r.attended_at AS fechaAsistencia
  FROM event_registrations r`;

class InscripcionRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getMysqlPool();
    }
    return this.pool;
  }

  async findByParticipante(eventId, registranteUuid, conn = null) {
    const executor = conn || this.getPool();
    const [rows] = await executor.query(
      `${SELECT_INSCRIPCION} WHERE r.event_id = ? AND r.registrant_uuid = ? LIMIT 1`,
      [eventId, registranteUuid],
    );
    return rows[0] || null;
  }

  /** Cuenta inscripciones que ocupan cupo (pending, confirmed, attended). */
  async contarOcupados(eventId, conn = null) {
    return this.contar(eventId, ESTADOS_QUE_OCUPAN_CUPO, conn);
  }

  /** Cuenta inscripciones activas (incluye lista de espera). */
  async contarActivas(eventId, conn = null) {
    return this.contar(eventId, ESTADOS_ACTIVOS, conn);
  }

  async contar(eventId, estados, conn = null) {
    const executor = conn || this.getPool();
    const [[{ total }]] = await executor.query(
      'SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ? AND status IN (?)',
      [eventId, estados],
    );
    return total;
  }

  async insert({ eventId, registranteUuid, registranteNombre }, conn = null) {
    const executor = conn || this.getPool();
    const ahora = new Date();
    await executor.query(
      `INSERT INTO event_registrations
        (uuid, event_id, registrant_uuid, registrant_name, status, confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        eventId,
        registranteUuid,
        registranteNombre,
        ESTADOS_INSCRIPCION.CONFIRMED,
        ahora,
      ],
    );
  }

  /** Reactiva una inscripción cancelada (la restricción uq impide insertar otra). */
  async reactivar(id, registranteNombre, conn = null) {
    const executor = conn || this.getPool();
    const ahora = new Date();
    await executor.query(
      `UPDATE event_registrations
       SET status = ?, registered_at = ?, confirmed_at = ?, cancelled_at = NULL,
           registrant_name = ?
       WHERE id = ?`,
      [ESTADOS_INSCRIPCION.CONFIRMED, ahora, ahora, registranteNombre, id],
    );
  }

  async cancelar(id, conn = null) {
    const executor = conn || this.getPool();
    await executor.query(
      'UPDATE event_registrations SET status = ?, cancelled_at = ? WHERE id = ?',
      [ESTADOS_INSCRIPCION.CANCELLED, new Date(), id],
    );
  }

  async findByEvento({ eventId, page, limit }) {
    const pool = this.getPool();
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM event_registrations WHERE event_id = ?',
      [eventId],
    );
    const [rows] = await pool.query(
      `${SELECT_INSCRIPCION} WHERE r.event_id = ?
       ORDER BY r.registered_at DESC, r.id DESC LIMIT ? OFFSET ?`,
      [eventId, limit, (page - 1) * limit],
    );
    return { rows, total };
  }
}

module.exports = InscripcionRepository;
