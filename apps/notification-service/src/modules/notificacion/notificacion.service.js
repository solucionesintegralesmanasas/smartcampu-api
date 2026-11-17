const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const { ForbiddenError, NotFoundError } = require('../../core/exceptions');

class NotificacionService {
  constructor(notificacionRepository) {
    this.notificacionRepository = notificacionRepository;
  }

  /**
   * Crea una notificación. Pensada para ser invocada tanto desde los
   * consumidores de eventos de dominio (reserva aprobada, PQRS respondida,
   * etc.) como desde un envío ad-hoc de un admin. Los canales que no son
   * `in_app` quedarían en `queued` para que un worker de envío real los
   * procese; como hoy no existe ese worker de email/push real, se marcan
   * `delivered` de inmediato solo para `in_app` (el registro en la tabla
   * ya es, en sí mismo, la entrega).
   */
  async create(dto) {
    const isInApp = (dto.channel ?? 'in_app') === 'in_app';
    const notificacion = await this.notificacionRepository.create({
      ...dto,
      channel: dto.channel ?? 'in_app',
      status: isInApp ? 'delivered' : 'queued',
      deliveredAt: isInApp ? new Date() : null,
    });

    await this.indexEntity(notificacion);

    return notificacion;
  }

  async findMine(user, {
    page = 1, limit = 10, status, channel,
  } = {}) {
    return this.notificacionRepository.findAll({
      page, limit, status, channel, recipientUuid: user.uuid,
    });
  }

  async countUnread(user) {
    const total = await this.notificacionRepository.countUnread(user.uuid);
    return { total };
  }

  async markRead(id, user) {
    const notificacion = await this.notificacionRepository.findById(id);
    if (!notificacion) {
      throw new NotFoundError('Notification not found');
    }
    if (notificacion.recipientUuid !== user.uuid) {
      throw new ForbiddenError('You do not have access to this notification');
    }
    return this.notificacionRepository.markRead(id);
  }

  async markAllRead(user) {
    const total = await this.notificacionRepository.markAllRead(user.uuid);
    return { total };
  }

  async indexEntity(notificacion) {
    try {
      await esClient.index({
        index: env.NOTIFICATION_INDEX,
        id: notificacion.uuid,
        document: {
          id: notificacion.id,
          uuid: notificacion.uuid,
          recipientUuid: notificacion.recipientUuid,
          channel: notificacion.channel,
          subject: notificacion.subject,
          sourceService: notificacion.sourceService,
          sourceEntity: notificacion.sourceEntity,
          status: notificacion.status,
          queuedAt: notificacion.queuedAt,
          readAt: notificacion.readAt,
        },
      });
    } catch (error) {
      // ES indexing is non-blocking
    }
  }
}

module.exports = NotificacionService;
