const { NotFoundError } = require('../../core/exceptions');

class BloqueoService {
  constructor(bloqueoRepository, recursoRepository) {
    this.bloqueoRepository = bloqueoRepository;
    this.recursoRepository = recursoRepository;
  }

  async create(resourceId, dto, actor) {
    const recurso = await this.recursoRepository.findById(resourceId);
    if (!recurso) {
      throw new NotFoundError('Resource not found');
    }
    return this.bloqueoRepository.create({
      resourceId,
      ...dto,
      createdByUuid: actor.uuid,
    });
  }

  async findByResourceId(resourceId) {
    const recurso = await this.recursoRepository.findById(resourceId);
    if (!recurso) {
      throw new NotFoundError('Resource not found');
    }
    return this.bloqueoRepository.findByResourceId(resourceId);
  }

  async delete(id) {
    const existing = await this.bloqueoRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Blackout not found');
    }
    await this.bloqueoRepository.delete(id);
  }
}

module.exports = BloqueoService;
