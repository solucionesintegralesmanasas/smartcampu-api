const PreferenciaService = require('../../src/modules/preferencia/preferencia.service');

function mockRepository(overrides = {}) {
  return {
    findByUser: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 1, ...dto })),
    ...overrides,
  };
}

const USER = {
  id: 1, uuid: 'user-uuid', nombre: 'Ana', roles: ['STUDENT'],
};

describe('PreferenciaService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new PreferenciaService(repo);
  });

  it('findMine consulta las preferencias del usuario autenticado', async () => {
    await service.findMine(USER);
    expect(repo.findByUser).toHaveBeenCalledWith('user-uuid');
  });

  it('setMine hace upsert con el uuid del propio usuario, no uno arbitrario', async () => {
    await service.setMine(USER, { category: 'booking', channel: 'email', isEnabled: false });
    expect(repo.upsert).toHaveBeenCalledWith({
      userUuid: 'user-uuid', category: 'booking', channel: 'email', isEnabled: false,
    });
  });
});
