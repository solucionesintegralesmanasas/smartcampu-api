const { destinatarioDe } = require('../../core/constants/notification.constants');
const { NotFoundError } = require('../../core/exceptions');

/**
 * Gestión de suscripciones push del usuario.
 */
class SuscripcionesService {
  constructor(repository) {
    this.repository = repository;
  }

  async registrar(usuario, dto) {
    return this.repository.upsert({
      userUuid: destinatarioDe(usuario.id),
      endpoint: dto.endpoint,
      authKey: dto.authKey,
      p256dhKey: dto.p256dhKey,
      deviceType: dto.deviceType,
      deviceLabel: dto.deviceLabel,
    });
  }

  async eliminar(usuario, uuid) {
    const eliminadas = await this.repository.deleteByUuidForUser(uuid, destinatarioDe(usuario.id));
    if (!eliminadas) {
      throw new NotFoundError('Suscripción no encontrada');
    }
    return { uuid, eliminada: true };
  }
}

module.exports = SuscripcionesService;
