const { NotFoundError } = require('../../src/core/exceptions');
const BloqueoService = require('../../src/modules/bloqueo/bloqueo.service');

function mockBloqueoRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue({ id: 1, resourceId: 1, reason: 'Mantenimiento' }),
    findByResourceId: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 1, resourceId: 1 }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockRecursoRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, name: 'Aula 101' }),
    ...overrides,
  };
}

const ACTOR = { id: 1, uuid: 'actor-uuid', roles: ['ADMIN'] };

describe('BloqueoService', () => {
  let bloqueoRepo;
  let recursoRepo;
  let service;

  beforeEach(() => {
    bloqueoRepo = mockBloqueoRepository();
    recursoRepo = mockRecursoRepository();
    service = new BloqueoService(bloqueoRepo, recursoRepo);
  });

  it('lanza NotFoundError si el recurso no existe', async () => {
    recursoRepo.findById.mockResolvedValue(null);
    await expect(service.create(999, { reason: 'x' }, ACTOR)).rejects.toThrow(NotFoundError);
    expect(bloqueoRepo.create).not.toHaveBeenCalled();
  });

  it('crea el bloqueo con el uuid del actor como creador', async () => {
    await service.create(1, { reason: 'Mantenimiento' }, ACTOR);
    expect(bloqueoRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 1, createdByUuid: 'actor-uuid' }),
    );
  });

  it('lanza NotFoundError al borrar si el bloqueo no existe', async () => {
    bloqueoRepo.findById.mockResolvedValue(null);
    await expect(service.delete(999)).rejects.toThrow(NotFoundError);
  });
});
