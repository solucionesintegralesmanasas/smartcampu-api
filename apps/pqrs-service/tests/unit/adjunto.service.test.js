const mockStorageClient = { getFile: jest.fn() };
jest.mock('../../src/clients/storage.client', () => mockStorageClient);

const { ForbiddenError, NotFoundError } = require('../../src/core/exceptions');
const AdjuntoService = require('../../src/modules/adjunto/adjunto.service');

function mockAdjuntoRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue({ id: 1, fileUuid: 'file-uuid' }),
    findByPqrsId: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 1, uploaderUuid: 'requester-uuid' }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockPqrsService(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({
      id: 1, requesterUuid: 'requester-uuid', isAnonymous: false,
    }),
    ...overrides,
  };
}

const REQUESTER = {
  id: 1, uuid: 'requester-uuid', nombre: 'Ana', roles: ['STUDENT'],
};

describe('AdjuntoService', () => {
  let adjuntoRepo;
  let pqrsService;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    adjuntoRepo = mockAdjuntoRepository();
    pqrsService = mockPqrsService();
    service = new AdjuntoService(adjuntoRepo, pqrsService);
    mockStorageClient.getFile.mockResolvedValue({
      uuid: 'file-uuid', originalName: 'documento.pdf', mimeType: 'application/pdf', sizeBytes: 1024,
    });
  });

  describe('create', () => {
    it('verifica acceso a la PQRS antes de adjuntar', async () => {
      await service.create(1, { fileId: 5 }, REQUESTER);
      expect(pqrsService.findById).toHaveBeenCalledWith(1, REQUESTER);
    });

    it('consulta storage-service en nombre del uploader', async () => {
      await service.create(1, { fileId: 5 }, REQUESTER);
      expect(mockStorageClient.getFile).toHaveBeenCalledWith(5, REQUESTER);
    });

    it('lanza NotFoundError si el archivo no existe o no le pertenece al uploader', async () => {
      mockStorageClient.getFile.mockResolvedValue(null);
      await expect(service.create(1, { fileId: 5 }, REQUESTER)).rejects.toThrow(NotFoundError);
      expect(adjuntoRepo.create).not.toHaveBeenCalled();
    });

    it('crea el adjunto con la metadata real de storage-service (no la del cliente)', async () => {
      await service.create(1, { fileId: 5 }, REQUESTER);
      expect(adjuntoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileUuid: 'file-uuid', originalName: 'documento.pdf', sizeBytes: 1024, uploaderUuid: 'requester-uuid',
        }),
      );
    });

    it('no guarda uploaderUuid si la PQRS es anónima', async () => {
      pqrsService.findById.mockResolvedValue({ id: 1, requesterUuid: null, isAnonymous: true });
      await service.create(1, { fileId: 5 }, REQUESTER);
      expect(adjuntoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ uploaderUuid: null }),
      );
    });
  });

  describe('delete', () => {
    it('lanza ForbiddenError si no es el uploader ni admin/staff', async () => {
      const other = { id: 3, uuid: 'other-uuid', roles: ['STUDENT'] };
      await expect(service.delete(1, other)).rejects.toThrow(ForbiddenError);
    });

    it('permite al uploader borrar su propio adjunto', async () => {
      await service.delete(1, REQUESTER);
      expect(adjuntoRepo.delete).toHaveBeenCalledWith(1);
    });
  });
});
