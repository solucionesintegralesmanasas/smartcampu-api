const { NotFoundError } = require('../../core/exceptions');

class SchedulesService {
  /**
   * @param {import('./schedules.repository')} schedulesRepository
   * @param {import('../resources/resources.repository')} resourcesRepository
   */
  constructor(schedulesRepository, resourcesRepository) {
    this.schedulesRepository = schedulesRepository;
    this.resourcesRepository = resourcesRepository;
  }

  async findByResource(resourceIdentifier) {
    const recurso = await this.findResource(resourceIdentifier);
    return this.schedulesRepository.findByResource(recurso.id);
  }

  async replace(resourceIdentifier, horarios) {
    const recurso = await this.findResource(resourceIdentifier);
    await this.schedulesRepository.replaceForResource(recurso.id, horarios);
    return this.schedulesRepository.findByResource(recurso.id);
  }

  async findResource(identifier) {
    const recurso = await this.resourcesRepository.findOne(identifier);
    if (!recurso) {
      throw new NotFoundError(`Recurso con ID ${identifier} no encontrado`);
    }
    return recurso;
  }
}

module.exports = SchedulesService;
