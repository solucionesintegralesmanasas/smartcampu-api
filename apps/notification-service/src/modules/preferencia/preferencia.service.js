class PreferenciaService {
  constructor(preferenciaRepository) {
    this.preferenciaRepository = preferenciaRepository;
  }

  async findMine(user) {
    return this.preferenciaRepository.findByUser(user.uuid);
  }

  async setMine(user, { category, channel, isEnabled }) {
    return this.preferenciaRepository.upsert({
      userUuid: user.uuid, category, channel, isEnabled,
    });
  }
}

module.exports = PreferenciaService;
