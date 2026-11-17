const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const PlantillaService = require('../../src/modules/plantilla/plantilla.service');

function mockRepository(overrides = {}) {
  return {
    findByCodeAndChannel: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'booking.approved', channel: 'in_app' }),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'booking.approved', channel: 'in_app' }),
    update: jest.fn().mockResolvedValue({ id: 1, code: 'booking.approved', channel: 'in_app' }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockRedis() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

describe('PlantillaService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new PlantillaService(repo, mockRedis());
  });

  it('lanza ConflictError si ya existe una plantilla con ese código y canal', async () => {
    repo.findByCodeAndChannel.mockResolvedValue({ id: 2 });
    await expect(
      service.create({ code: 'booking.approved', channel: 'in_app' }),
    ).rejects.toThrow(ConflictError);
  });

  it('crea la plantilla si no existe una con ese código y canal', async () => {
    const result = await service.create({ code: 'booking.approved', channel: 'in_app' });
    expect(repo.create).toHaveBeenCalledWith({ code: 'booking.approved', channel: 'in_app' });
    expect(result.id).toBe(1);
  });

  it('lanza NotFoundError si la plantilla no existe', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.findById(99)).rejects.toThrow(NotFoundError);
  });

  it('lanza NotFoundError al actualizar una plantilla inexistente', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.update(99, { name: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('borra la plantilla si existe', async () => {
    await service.delete(1);
    expect(repo.delete).toHaveBeenCalledWith(1);
  });
});
