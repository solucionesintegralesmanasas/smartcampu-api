const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const HorarioService = require('../../src/modules/horario/horario.service');

function mockHorarioRepository(overrides = {}) {
  return {
    findByResourceAndDay: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, resourceId: 1, dayOfWeek: 1 }),
    findByResourceId: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 1, resourceId: 1 }),
    update: jest.fn().mockResolvedValue({ id: 1, openTime: '09:00:00' }),
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

describe('HorarioService', () => {
  let horarioRepo;
  let recursoRepo;
  let service;

  beforeEach(() => {
    horarioRepo = mockHorarioRepository();
    recursoRepo = mockRecursoRepository();
    service = new HorarioService(horarioRepo, recursoRepo);
  });

  it('lanza NotFoundError si el recurso no existe', async () => {
    recursoRepo.findById.mockResolvedValue(null);
    await expect(service.create(999, { dayOfWeek: 1 })).rejects.toThrow(NotFoundError);
    expect(horarioRepo.create).not.toHaveBeenCalled();
  });

  it('lanza ConflictError si ya existe un horario para ese día', async () => {
    horarioRepo.findByResourceAndDay.mockResolvedValue({ id: 5 });
    await expect(service.create(1, { dayOfWeek: 1 })).rejects.toThrow(ConflictError);
  });

  it('crea el horario si el recurso existe y el día está libre', async () => {
    const result = await service.create(1, { dayOfWeek: 1, openTime: '08:00', closeTime: '18:00' });
    expect(result.id).toBe(1);
  });
});
