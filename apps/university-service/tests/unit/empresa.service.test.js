const { ConflictError, NotFoundError } = require('../../src/core/exceptions');
const EmpresaService = require('../../src/modules/empresa/empresa.service');

function mockRepository(overrides = {}) {
  return {
    findByTaxId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 1, legalName: 'ACME SAS', taxId: '900123456' }),
    findById: jest.fn().mockResolvedValue({ id: 1, legalName: 'ACME SAS', taxId: '900123456' }),
    update: jest.fn().mockResolvedValue({ id: 1, legalName: 'ACME Corp' }),
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

describe('EmpresaService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new EmpresaService(repo, mockRedis());
  });

  describe('create', () => {
    it('lanza ConflictError si el NIT ya existe', async () => {
      repo.findByTaxId.mockResolvedValue({ id: 2 });
      await expect(service.create({ taxId: '900123456' })).rejects.toThrow(ConflictError);
    });

    it('crea la empresa si el NIT no existe', async () => {
      const result = await service.create({ taxId: '900123456', legalName: 'ACME SAS' });
      expect(result.id).toBe(1);
    });
  });

  describe('findById', () => {
    it('lanza NotFoundError si no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundError);
    });
  });
});
