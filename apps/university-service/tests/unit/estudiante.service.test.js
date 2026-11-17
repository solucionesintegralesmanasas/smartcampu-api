jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const EstudianteService = require('../../src/modules/estudiante/estudiante.service');

function mockEstudianteRepository(overrides = {}) {
  return {
    findByPersonId: jest.fn().mockResolvedValue(null),
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 'e1', studentCode: 'EST-001', personId: 1, programId: 1,
    }),
    findById: jest.fn().mockResolvedValue({ id: 1, uuid: 'e1', studentCode: 'EST-001' }),
    findByUserUuid: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ id: 1, currentSemester: 3 }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockTerceroRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 't1', firstName: 'Ana', lastName: 'Pérez',
    }),
    ...overrides,
  };
}

function mockProgramaRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, uuid: 'p1', name: 'Ing. de Sistemas' }),
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

describe('EstudianteService', () => {
  let estudianteRepo;
  let terceroRepo;
  let programaRepo;
  let service;

  beforeEach(() => {
    estudianteRepo = mockEstudianteRepository();
    terceroRepo = mockTerceroRepository();
    programaRepo = mockProgramaRepository();
    service = new EstudianteService(estudianteRepo, terceroRepo, programaRepo, mockRedis());
  });

  describe('create', () => {
    it('lanza NotFoundError si la persona no existe', async () => {
      terceroRepo.findById.mockResolvedValue(null);
      await expect(
        service.create({ personId: 999, programId: 1, studentCode: 'EST-001' }),
      ).rejects.toThrow(NotFoundError);
      expect(estudianteRepo.create).not.toHaveBeenCalled();
    });

    it('lanza NotFoundError si el programa no existe', async () => {
      programaRepo.findById.mockResolvedValue(null);
      await expect(
        service.create({ personId: 1, programId: 999, studentCode: 'EST-001' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('lanza ConflictError si la persona ya es estudiante', async () => {
      estudianteRepo.findByPersonId.mockResolvedValue({ id: 5 });
      await expect(
        service.create({ personId: 1, programId: 1, studentCode: 'EST-001' }),
      ).rejects.toThrow(ConflictError);
    });

    it('lanza ConflictError si el código de estudiante ya existe', async () => {
      estudianteRepo.findByCode.mockResolvedValue({ id: 5 });
      await expect(
        service.create({ personId: 1, programId: 1, studentCode: 'EST-001' }),
      ).rejects.toThrow(ConflictError);
    });

    it('crea el estudiante si la persona y el programa existen y no hay duplicados', async () => {
      const result = await service.create({
        personId: 1, programId: 1, studentCode: 'EST-001', enrollmentDate: '2026-01-15',
      });
      expect(result.id).toBe(1);
    });
  });

  describe('findByUserUuid', () => {
    it('lanza NotFoundError si no hay estudiante vinculado a ese usuario', async () => {
      await expect(service.findByUserUuid('unknown-uuid')).rejects.toThrow(NotFoundError);
    });

    it('retorna el estudiante si existe el vínculo', async () => {
      estudianteRepo.findByUserUuid.mockResolvedValue({ id: 1, userUuid: 'u1' });
      const result = await service.findByUserUuid('u1');
      expect(result.userUuid).toBe('u1');
    });
  });
});
