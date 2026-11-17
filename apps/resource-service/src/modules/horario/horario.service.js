const { ConflictError, NotFoundError } = require('../../core/exceptions');

class HorarioService {
  constructor(horarioRepository, recursoRepository) {
    this.horarioRepository = horarioRepository;
    this.recursoRepository = recursoRepository;
  }

  async create(resourceId, dto) {
    const recurso = await this.recursoRepository.findById(resourceId);
    if (!recurso) {
      throw new NotFoundError('Resource not found');
    }

    const existing = await this.horarioRepository.findByResourceAndDay(resourceId, dto.dayOfWeek);
    if (existing) {
      throw new ConflictError('A schedule already exists for this resource and day of week');
    }

    return this.horarioRepository.create({ resourceId, ...dto });
  }

  async findByResourceId(resourceId) {
    const recurso = await this.recursoRepository.findById(resourceId);
    if (!recurso) {
      throw new NotFoundError('Resource not found');
    }
    return this.horarioRepository.findByResourceId(resourceId);
  }

  async update(id, dto) {
    const existing = await this.horarioRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Schedule not found');
    }
    return this.horarioRepository.update(id, dto);
  }

  async delete(id) {
    const existing = await this.horarioRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Schedule not found');
    }
    await this.horarioRepository.delete(id);
  }
}

module.exports = HorarioService;
