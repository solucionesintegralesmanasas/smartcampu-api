const {
  DESTINATARIO_DIFUSION,
  destinatarioDe,
} = require('../../core/constants/notification.constants');
const { NotFoundError } = require('../../core/exceptions');
const { getPaginationMeta } = require('../../core/helpers/pagination.helper');

const toDto = (row) => ({
  uuid: row.uuid,
  asunto: row.subject,
  cuerpo: row.body,
  canal: row.channel,
  estado: row.status,
  leida: row.status === 'read',
  esDifusion: row.recipientUuid === DESTINATARIO_DIFUSION,
  origen: {
    servicio: row.sourceService,
    entidad: row.sourceEntity,
    uuid: row.sourceUuid,
  },
  creadaEn: row.queuedAt,
  leidaEn: row.readAt,
});

/**
 * Lógica de negocio de notificaciones in-app del usuario y difusiones manuales.
 */
class NotificacionesService {
  /**
   * @param {import('./notificaciones.repository')} repository
   * @param {import('../../core/services/notification-dispatcher.service')} dispatcher
   */
  constructor(repository, dispatcher) {
    this.repository = repository;
    this.dispatcher = dispatcher;
  }

  async listar(usuario, filtros = {}) {
    const page = filtros.page || 1;
    const limit = filtros.limit || 20;
    const offset = (page - 1) * limit;

    const { rows, total } = await this.repository.listForRecipient({
      recipientUuid: destinatarioDe(usuario.id),
      broadcastUuid: DESTINATARIO_DIFUSION,
      leida: filtros.leida,
      limit,
      offset,
    });

    return { data: rows.map(toDto), meta: getPaginationMeta(page, limit, total) };
  }

  async marcarLeida(usuario, uuid) {
    const notificacion = await this.repository.findByUuid(uuid);
    if (!notificacion || notificacion.recipientUuid !== destinatarioDe(usuario.id)) {
      throw new NotFoundError('Notificación no encontrada');
    }
    await this.repository.markRead(notificacion.id);
    return { uuid, leida: true };
  }

  async marcarTodasLeidas(usuario) {
    const actualizadas = await this.repository.markAllReadForRecipient(destinatarioDe(usuario.id));
    return { actualizadas: Number(actualizadas) };
  }

  async difundir(dto, usuario) {
    const notificacion = await this.dispatcher.createManualBroadcast({
      titulo: dto.titulo,
      mensaje: dto.mensaje,
      creadoPor: usuario.id,
    });
    return { uuid: notificacion.uuid };
  }
}

module.exports = NotificacionesService;
