jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));

const mockDriver = {
  name: 'local',
  save: jest.fn().mockResolvedValue(undefined),
  read: jest.fn(),
  createReadStream: jest.fn().mockReturnValue({ on: jest.fn(), pipe: jest.fn() }),
  delete: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../src/config/storage', () => ({
  getStorageDriver: () => mockDriver,
}));

const { esClient } = require('../../src/config/elasticsearch');
const { ForbiddenError, NotFoundError } = require('../../src/core/exceptions');
const ArchivoService = require('../../src/modules/archivo/archivo.service');

function mockRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue({
      id: 1,
      uuid: 'f1',
      originalName: 'foto.jpg',
      storedName: 'generated-uuid.jpg',
      storagePath: 'generated-uuid.jpg',
      mimeType: 'image/jpeg',
      ownerUserUuid: 'owner-uuid',
      isActive: 1,
    }),
    findById: jest.fn().mockResolvedValue({
      id: 1,
      uuid: 'f1',
      originalName: 'foto.jpg',
      storagePath: 'generated-uuid.jpg',
      mimeType: 'image/jpeg',
      ownerUserUuid: 'owner-uuid',
      isActive: 1,
    }),
    findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const OWNER = { id: 1, uuid: 'owner-uuid', roles: ['STUDENT'] };
const OTHER_USER = { id: 2, uuid: 'other-uuid', roles: ['STUDENT'] };
const ADMIN = { id: 3, uuid: 'admin-uuid', roles: ['ADMIN'] };

describe('ArchivoService', () => {
  let repo;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = mockRepository();
    service = new ArchivoService(repo);
  });

  describe('upload', () => {
    it('guarda el archivo en el driver, calcula el checksum y crea el registro', async () => {
      const file = {
        originalname: 'foto.jpg',
        mimetype: 'image/jpeg',
        size: 1234,
        buffer: Buffer.from('contenido de prueba'),
      };

      const result = await service.upload(file, OWNER, {});

      expect(mockDriver.save).toHaveBeenCalledWith(expect.stringMatching(/\.jpg$/), file.buffer);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          originalName: 'foto.jpg',
          ownerUserUuid: 'owner-uuid',
          checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
      expect(esClient.index).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });
  });

  describe('findById', () => {
    it('lanza NotFoundError si el archivo no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(999, OWNER)).rejects.toThrow(NotFoundError);
    });

    it('permite al dueño acceder a su propio archivo', async () => {
      const result = await service.findById(1, OWNER);
      expect(result.id).toBe(1);
    });

    it('permite a un admin acceder a un archivo ajeno', async () => {
      const result = await service.findById(1, ADMIN);
      expect(result.id).toBe(1);
    });

    it('lanza ForbiddenError si un usuario intenta acceder al archivo de otro', async () => {
      await expect(service.findById(1, OTHER_USER)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('findAll', () => {
    it('fuerza el filtro al propio usuario si no es admin', async () => {
      await service.findAll(OWNER, { page: 1, limit: 10 });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserUuid: 'owner-uuid' }),
      );
    });

    it('no fuerza el filtro si el usuario es admin', async () => {
      await service.findAll(ADMIN, { page: 1, limit: 10 });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserUuid: undefined }),
      );
    });
  });

  describe('delete', () => {
    it('bloquea el borrado si el usuario no es el dueño ni admin', async () => {
      await expect(service.delete(1, OTHER_USER)).rejects.toThrow(ForbiddenError);
      expect(repo.delete).not.toHaveBeenCalled();
      expect(mockDriver.delete).not.toHaveBeenCalled();
    });

    it('borra el registro y el archivo físico si el usuario es el dueño', async () => {
      await service.delete(1, OWNER);
      expect(repo.delete).toHaveBeenCalledWith(1);
      expect(mockDriver.delete).toHaveBeenCalledWith('generated-uuid.jpg');
    });
  });
});
