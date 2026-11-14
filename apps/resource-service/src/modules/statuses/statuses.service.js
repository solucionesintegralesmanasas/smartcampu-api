class StatusesService {
  /**
   * @param {import('./statuses.repository')} statusesRepository
   */
  constructor(statusesRepository) {
    this.statusesRepository = statusesRepository;
  }

  async findAll() {
    return this.statusesRepository.findAllActive();
  }
}

module.exports = StatusesService;
