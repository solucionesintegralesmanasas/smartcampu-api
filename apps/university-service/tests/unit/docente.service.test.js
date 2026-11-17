jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const DocenteService = require('../../src/modules/docente/docente.service');

function mockDocenteRepository(overrides = {}) {
  return {
    findByPersonId: jest.fn().mockResolvedValue(null),
    findByCode: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 'd1', teacherCode: 'DOC-001', personId: 1, facultyId: 1,
    }),
    findById: jest.fn().mockResolvedValue({ id: 1, uuid: 'd1', teacherCode: 'DOC-001' }),
    findByUserUuid: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ id: 1, status: 'inactive' }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockTerceroRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 't1', firstName: 'Carlos', lastName: 'Ruiz',
    }),
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

describe('DocenteService', () => {
  let docenteRepo;
  let terceroRepo;
  let facultadRepo;
  let service;

  beforeEach(() => {
    docenteRepo = mockDocenteRepository();
    terceroRepo = mockTerceroRepository();
    facultadRepo = mockFacultadRepository();
    service = new DocenteService(docenteRepo, terceroRepo, facultadRepo, mockRedis());
  });

  describe('create', () => {
    it('lanza NotFoundError si la persona no existe', async () => {
      terceroRepo.findById.mockResolvedValue(null);
      await expect(
        service.create({ personId: 999, facultyId: 1, teacherCode: 'DOC-001' }),
      ).rejects.toThrow(NotFoundError);
      expect(docenteRepo.create).not.toHaveBeenCalled();
    });

    it('lanza NotFoundError si la facultad no existe', async () => {
      facultadRepo.findById.mockResolvedValue(null);
      await expect(
        service.create({ personId: 1, facultyId: 999, teacherCode: 'DOC-001' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('lanza ConflictError si la persona ya es docente', async () => {
      docenteRepo.findByPersonId.mockResolvedValue({ id: 5 });
      await expect(
        service.create({ personId: 1, facultyId: 1, teacherCode: 'DOC-001' }),
      ).rejects.toThrow(ConflictError);
    });

    it('lanza ConflictError si el código de docente ya existe', async () => {
      docenteRepo.findByCode.mockResolvedValue({ id: 5 });
      await expect(
        service.create({ personId: 1, facultyId: 1, teacherCode: 'DOC-001' }),
      ).rejects.toThrow(ConflictError);
    });

    it('crea el docente si la persona y la facultad existen y no hay duplicados', async () => {
      const result = await service.create({
        personId: 1, facultyId: 1, teacherCode: 'DOC-001', hireDate: '2026-01-15', contractType: 'full_time',
      });
      expect(result.id).toBe(1);
    });
  });

  describe('findByUserUuid', () => {
    it('lanza NotFoundError si no hay docente vinculado a ese usuario', async () => {
      await expect(service.findByUserUuid('unknown-uuid')).rejects.toThrow(NotFoundError);
    });

    it('retorna el docente si existe el vínculo', async () => {
      docenteRepo.findByUserUuid.mockResolvedValue({ id: 1, userUuid: 'u1' });
      const result = await service.findByUserUuid('u1');
      expect(result.userUuid).toBe('u1');
    });
  });
});
