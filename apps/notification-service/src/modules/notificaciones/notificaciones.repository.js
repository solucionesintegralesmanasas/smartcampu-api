const { v4: uuidv4 } = require('uuid');

const { getMysqlPool } = require('../../config/database/mysql');
const { CANALES, ESTADOS } = require('../../core/constants/notification.constants');

const COLUMNAS = `
  id, uuid, template_id AS templateId, recipient_uuid AS recipientUuid,
  recipient_email AS recipientEmail, channel, subject, body,
  source_service AS sourceService, source_entity AS sourceEntity, source_uuid AS sourceUuid,
  status, queued_at AS queuedAt, sent_at AS sentAt, delivered_at AS deliveredAt,
  read_at AS readAt, failed_at AS failedAt, failure_reason AS failureReason,
  retry_count AS retryCount, metadata`;

const CAMPOS_ACTUALIZABLES = Object.freeze({
  status: 'status',
  sentAt: 'sent_at',
  deliveredAt: 'delivered_at',
  readAt: 'read_at',
  failedAt: 'failed_at',
  failureReason: 'failure_reason',
  retryCount: 'retry_count',
});

class NotificacionesRepository {
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
   * Inserta una notificación y devuelve el registro creado.
   * @param {Object} data - Campos en camelCase (ver columnas de la tabla notifications).
   */
  async create(data) {
    const uuid = uuidv4();
    const result = await this.getPool().query(
      `INSERT INTO notifications (
         uuid, template_id, recipient_uuid, recipient_email, channel, subject, body,
         source_service, source_entity, source_uuid, status, sent_at, delivered_at,
         failed_at, failure_reason, retry_count, metadata
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        data.templateId ?? null,
        data.recipientUuid,
        data.recipientEmail ?? null,
        data.channel,
        data.subject ?? null,
        data.body,
        data.sourceService ?? null,
        data.sourceEntity ?? null,
        data.sourceUuid ?? null,
        data.status ?? ESTADOS.QUEUED,
        data.sentAt ?? null,
        data.deliveredAt ?? null,
        data.failedAt ?? null,
        data.failureReason ?? null,
        data.retryCount ?? 0,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ],
    );
    return { ...data, id: result.insertId, uuid };
  }

  async findByUuid(uuid) {
    const rows = await this.getPool().query(
      `SELECT ${COLUMNAS} FROM notifications WHERE uuid = ? LIMIT 1`,
      [uuid],
    );
    return rows[0] || null;
  }

  async findById(id) {
    const rows = await this.getPool().query(
      `SELECT ${COLUMNAS} FROM notifications WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] || null;
  }

  /**
   * Notificaciones in-app visibles para un destinatario: las suyas y las difusiones.
   * @param {Object} filtros
   * @param {string} filtros.recipientUuid - Destinatario.
   * @param {string} filtros.broadcastUuid - Destinatario centinela de difusiones.
   * @param {boolean} [filtros.leida] - true: sólo leídas; false: sólo no leídas; undefined: todas.
   */
  async listForRecipient({
    recipientUuid, broadcastUuid, leida, limit, offset,
  }) {
    const condiciones = ['channel = ?', '(recipient_uuid = ? OR recipient_uuid = ?)'];
    const params = [CANALES.IN_APP, recipientUuid, broadcastUuid];

    if (leida === true) condiciones.push(`status = '${ESTADOS.READ}'`);
    if (leida === false) condiciones.push(`status <> '${ESTADOS.READ}'`);

    const where = `WHERE ${condiciones.join(' AND ')}`;
    const pool = this.getPool();
    const conteo = await pool.query(`SELECT COUNT(*) AS total FROM notifications ${where}`, params);
    const rows = await pool.query(
      `SELECT ${COLUMNAS} FROM notifications ${where}
       ORDER BY queued_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return { rows, total: conteo[0]?.total || 0 };
  }

  async markRead(id) {
    const result = await this.getPool().query(
      `UPDATE notifications SET status = ?, read_at = NOW()
       WHERE id = ? AND status <> ?`,
      [ESTADOS.READ, id, ESTADOS.READ],
    );
    return result.affectedRows;
  }

  async markAllReadForRecipient(recipientUuid) {
    const result = await this.getPool().query(
      `UPDATE notifications SET status = ?, read_at = NOW()
       WHERE recipient_uuid = ? AND channel = ? AND status <> ?`,
      [ESTADOS.READ, recipientUuid, CANALES.IN_APP, ESTADOS.READ],
    );
    return result.affectedRows;
  }

  /**
   * Actualiza campos de entrega de una notificación.
   * @param {number} id
   * @param {Object} campos - Claves camelCase de CAMPOS_ACTUALIZABLES.
   */
  async updateStatus(id, campos) {
    const sets = [];
    const params = [];
    Object.entries(campos).forEach(([clave, valor]) => {
      const columna = CAMPOS_ACTUALIZABLES[clave];
      if (columna) {
        sets.push(`${columna} = ?`);
        params.push(valor);
      }
    });
    if (!sets.length) return 0;
    const result = await this.getPool().query(
      `UPDATE notifications SET ${sets.join(', ')} WHERE id = ?`,
      [...params, id],
    );
    return result.affectedRows;
  }
}

module.exports = NotificacionesRepository;
