jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const ProgramaService = require('../../src/modules/programa/programa.service');

function mockProgramaRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 'p1', code: 'SIS', name: 'Ing. de Sistemas', facultyId: 1, isActive: 1,
    }),
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 'p1', code: 'SIS', name: 'Ing. de Sistemas', facultyId: 1, isActive: 1,
    }),
    update: jest.fn().mockResolvedValue({ id: 1, name: 'Ing. de Sistemas y Computación' }),
    delete: jest.fn().mockResolvedValue(true),
    countActiveStudents: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function mockFacultadRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, uuid: 'f1', name: 'Ingeniería' }),
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

describe('ProgramaService', () => {
  let programaRepo;
  let facultadRepo;
  let service;

  beforeEach(() => {
    programaRepo = mockProgramaRepository();
    facultadRepo = mockFacultadRepository();
    service = new ProgramaService(programaRepo, facultadRepo, mockRedis());
  });

  describe('create', () => {
    it('lanza NotFoundError si la facultad no existe', async () => {
      facultadRepo.findById.mockResolvedValue(null);
      await expect(service.create({ facultyId: 999, code: 'SIS' })).rejects.toThrow(NotFoundError);
      expect(programaRepo.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictError si el código ya existe', async () => {
      programaRepo.findByCode.mockResolvedValue({ id: 2 });
      await expect(service.create({ facultyId: 1, code: 'SIS' })).rejects.toThrow(ConflictError);
    });

    it('crea el programa si la facultad existe y el código es único', async () => {
      const result = await service.create({ facultyId: 1, code: 'SIS', name: 'Ing. de Sistemas' });
      expect(result.id).toBe(1);
    });
  });

  describe('delete', () => {
    it('bloquea el borrado si tiene estudiantes activos', async () => {
      programaRepo.countActiveStudents.mockResolvedValue(5);
      await expect(service.delete(1)).rejects.toThrow(ConflictError);
    });

    it('borra el programa si no tiene estudiantes activos', async () => {
      await service.delete(1);
      expect(programaRepo.delete).toHaveBeenCalledWith(1);
    });
  });
});
