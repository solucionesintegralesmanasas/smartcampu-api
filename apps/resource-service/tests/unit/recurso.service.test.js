jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const RecursoService = require('../../src/modules/recurso/recurso.service');

function mockRecursoRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 'r1', code: 'AULA-101', name: 'Aula 101', statusId: 1, isActive: 1,
    }),
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 'r1', code: 'AULA-101', name: 'Aula 101', statusId: 1, isActive: 1,
    }),
    findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    update: jest.fn().mockResolvedValue({ id: 1, name: 'Aula 101 renovada' }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockCategoriaRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, name: 'Aulas' }),
    ...overrides,
  };
}

function mockEstadoRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, code: 'available', isBookable: 1 }),
    ...overrides,
  };
}

function mockHorarioRepository(overrides = {}) {
  return {
    findByResourceAndDay: jest.fn().mockResolvedValue({
      id: 1, resourceId: 1, dayOfWeek: 1, openTime: '08:00:00', closeTime: '18:00:00',
    }),
    ...overrides,
  };
}

function mockBloqueoRepository(overrides = {}) {
  return {
    findOverlapping: jest.fn().mockResolvedValue(null),
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

describe('RecursoService', () => {
  let recursoRepo;
  let categoriaRepo;
  let estadoRepo;
  let horarioRepo;
  let bloqueoRepo;
  let service;

  beforeEach(() => {
    recursoRepo = mockRecursoRepository();
    categoriaRepo = mockCategoriaRepository();
    estadoRepo = mockEstadoRepository();
    horarioRepo = mockHorarioRepository();
    bloqueoRepo = mockBloqueoRepository();
    service = new RecursoService(recursoRepo, categoriaRepo, estadoRepo, horarioRepo, bloqueoRepo, mockRedis());
  });

  describe('create', () => {
    it('lanza NotFoundError si la categoría no existe', async () => {
      categoriaRepo.findById.mockResolvedValue(null);
      await expect(service.create({ categoryId: 999, statusId: 1, code: 'X' })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('lanza NotFoundError si el estado no existe', async () => {
      estadoRepo.findById.mockResolvedValue(null);
      await expect(service.create({ categoryId: 1, statusId: 999, code: 'X' })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('lanza ConflictError si el código ya existe', async () => {
      recursoRepo.findByCode.mockResolvedValue({ id: 2 });
      await expect(service.create({ categoryId: 1, statusId: 1, code: 'AULA-101' })).rejects.toThrow(
        ConflictError,
      );
    });

    it('crea el recurso si todo es válido', async () => {
      const result = await service.create({ categoryId: 1, statusId: 1, code: 'AULA-101' });
      expect(result.id).toBe(1);
    });
  });

  describe('checkAvailability', () => {
    // 2026-01-05 es lunes -> getUTCDay() = 1
    const query = { date: '2026-01-05', startTime: '09:00', endTime: '10:00' };

    it('no disponible si el estado del recurso no es reservable', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 1, isBookable: 0 });
      const result = await service.checkAvailability(1, query);
      expect(result).toEqual({ available: false, reason: 'resource_not_bookable' });
    });

    it('no disponible si no hay horario definido para ese día', async () => {
      horarioRepo.findByResourceAndDay.mockResolvedValue(null);
      const result = await service.checkAvailability(1, query);
      expect(result).toEqual({ available: false, reason: 'closed_on_this_day' });
    });

    it('no disponible si el rango pedido cae fuera del horario', async () => {
      horarioRepo.findByResourceAndDay.mockResolvedValue({
        openTime: '14:00:00', closeTime: '18:00:00',
      });
      const result = await service.checkAvailability(1, query);
      expect(result).toEqual({ available: false, reason: 'outside_operating_hours' });
    });

    it('no disponible si hay un bloqueo que se traslapa', async () => {
      bloqueoRepo.findOverlapping.mockResolvedValue({ reason: 'Mantenimiento eléctrico' });
      const result = await service.checkAvailability(1, query);
      expect(result).toEqual({
        available: false, reason: 'blackout', blackoutReason: 'Mantenimiento eléctrico',
      });
    });

    it('disponible si el estado es reservable, está dentro de horario y sin bloqueos', async () => {
      const result = await service.checkAvailability(1, query);
      expect(result).toEqual({ available: true });
    });

    it('lanza NotFoundError si el recurso no existe', async () => {
      recursoRepo.findById.mockResolvedValue(null);
      await expect(service.checkAvailability(999, query)).rejects.toThrow(NotFoundError);
    });
  });
});
