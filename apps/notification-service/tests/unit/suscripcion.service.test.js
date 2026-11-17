const { ForbiddenError, NotFoundError } = require('../../src/core/exceptions');
const SuscripcionService = require('../../src/modules/suscripcion/suscripcion.service');

function mockRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue({ id: 1, userUuid: 'user-uuid', endpoint: 'https://push/1' }),
    findByUser: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 1, userUuid: 'user-uuid' }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const USER = {
  id: 1, uuid: 'user-uuid', nombre: 'Ana', roles: ['STUDENT'],
};
const OTHER_USER = {
  id: 2, uuid: 'other-uuid', nombre: 'Otro', roles: ['STUDENT'],
};

describe('SuscripcionService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new SuscripcionService(repo);
  });

  it('create asocia la suscripción al usuario autenticado', async () => {
    await service.create({ endpoint: 'https://push/1', authKey: 'a', p256dhKey: 'b' }, USER);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userUuid: 'user-uuid' }));
  });

  it('findMine consulta solo las suscripciones del usuario autenticado', async () => {
    await service.findMine(USER);
    expect(repo.findByUser).toHaveBeenCalledWith('user-uuid');
  });

  it('delete lanza NotFoundError si no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.delete(99, USER)).rejects.toThrow(NotFoundError);
  });

  it('delete lanza ForbiddenError si no es el dueño', async () => {
    await expect(service.delete(1, OTHER_USER)).rejects.toThrow(ForbiddenError);
  });

  it('delete funciona para el propio dueño', async () => {
    await service.delete(1, USER);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });
});
