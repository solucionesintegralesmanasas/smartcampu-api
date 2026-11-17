const { ForbiddenError, NotFoundError } = require('../../core/exceptions');

class SuscripcionService {
  constructor(suscripcionRepository) {
    this.suscripcionRepository = suscripcionRepository;
  }

  async create(dto, user) {
    return this.suscripcionRepository.create({
      userUuid: user.uuid,
      endpoint: dto.endpoint,
      authKey: dto.authKey,
      p256dhKey: dto.p256dhKey,
      deviceType: dto.deviceType,
      deviceLabel: dto.deviceLabel,
    });
  }

  async findMine(user) {
    return this.suscripcionRepository.findByUser(user.uuid);
  }

  async delete(id, user) {
    const subscription = await this.suscripcionRepository.findById(id);
    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }
    if (subscription.userUuid !== user.uuid) {
      throw new ForbiddenError('You can only remove your own subscriptions');
    }
    await this.suscripcionRepository.delete(id);
  }
}

module.exports = SuscripcionService;
