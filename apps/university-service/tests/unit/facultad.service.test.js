jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const FacultadService = require('../../src/modules/facultad/facultad.service');

function mockFacultadRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 'f1', code: 'ING', name: 'Ingeniería', campusId: 1, isActive: 1,
    }),
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 'f1', code: 'ING', name: 'Ingeniería', campusId: 1, isActive: 1,
    }),
    update: jest.fn().mockResolvedValue({ id: 1, name: 'Ingeniería y Afines' }),
    delete: jest.fn().mockResolvedValue(true),
    countActivePrograms: jest.fn().mockResolvedValue(0),
    countActiveTeachers: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function mockSedeRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, uuid: 's1', name: 'Sede Bogotá' }),
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

describe('FacultadService', () => {
  let facultadRepo;
  let sedeRepo;
  let service;

  beforeEach(() => {
    facultadRepo = mockFacultadRepository();
    sedeRepo = mockSedeRepository();
    service = new FacultadService(facultadRepo, sedeRepo, mockRedis());
  });

  describe('create', () => {
    it('lanza NotFoundError si la sede no existe', async () => {
      sedeRepo.findById.mockResolvedValue(null);
      await expect(service.create({ campusId: 999, code: 'ING' })).rejects.toThrow(NotFoundError);
      expect(facultadRepo.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictError si el código ya existe', async () => {
      facultadRepo.findByCode.mockResolvedValue({ id: 2 });
      await expect(service.create({ campusId: 1, code: 'ING' })).rejects.toThrow(ConflictError);
    });

    it('crea la facultad si la sede existe y el código es único', async () => {
      const result = await service.create({ campusId: 1, code: 'ING', name: 'Ingeniería' });
      expect(result.id).toBe(1);
    });
  });

  describe('delete', () => {
    it('bloquea el borrado si tiene programas activos', async () => {
      facultadRepo.countActivePrograms.mockResolvedValue(1);
      await expect(service.delete(1)).rejects.toThrow(ConflictError);
    });

    it('bloquea el borrado si tiene docentes activos', async () => {
      facultadRepo.countActiveTeachers.mockResolvedValue(1);
      await expect(service.delete(1)).rejects.toThrow(ConflictError);
    });

    it('borra la facultad si no tiene programas ni docentes activos', async () => {
      await service.delete(1);
      expect(facultadRepo.delete).toHaveBeenCalledWith(1);
    });
  });
});
