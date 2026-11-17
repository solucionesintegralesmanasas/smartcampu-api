const { ForbiddenError, NotFoundError } = require('../../src/core/exceptions');
const ComentarioService = require('../../src/modules/comentario/comentario.service');

function mockComentarioRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue({ id: 1, body: 'hola' }),
    findByRequestId: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 1, authorUuid: 'requester-uuid' }),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockSolicitudService(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, requesterUuid: 'requester-uuid' }),
    ...overrides,
  };
}

const REQUESTER = {
  id: 1, uuid: 'requester-uuid', nombre: 'Ana', roles: ['STUDENT'],
};
const STAFF = {
  id: 2, uuid: 'staff-uuid', nombre: 'Staff', roles: ['STAFF'],
};

describe('ComentarioService', () => {
  let comentarioRepo;
  let solicitudService;
  let service;

  beforeEach(() => {
    comentarioRepo = mockComentarioRepository();
    solicitudService = mockSolicitudService();
    service = new ComentarioService(comentarioRepo, solicitudService);
  });

  describe('create', () => {
    it('verifica acceso a la solicitud antes de comentar', async () => {
      await service.create(1, { body: 'hola' }, REQUESTER);
      expect(solicitudService.findById).toHaveBeenCalledWith(1, REQUESTER);
    });

    it('lanza ForbiddenError si un usuario normal intenta postear un comentario interno', async () => {
      await expect(
        service.create(1, { body: 'nota', isInternal: true }, REQUESTER),
      ).rejects.toThrow(ForbiddenError);
      expect(comentarioRepo.create).not.toHaveBeenCalled();
    });

    it('permite a staff postear un comentario interno', async () => {
      await service.create(1, { body: 'nota', isInternal: true }, STAFF);
      expect(comentarioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isInternal: true }),
      );
    });
  });

  describe('findByRequestId', () => {
    it('oculta comentarios internos a un usuario normal', async () => {
      await service.findByRequestId(1, REQUESTER);
      expect(comentarioRepo.findByRequestId).toHaveBeenCalledWith(1, { includeInternal: false });
    });

    it('muestra comentarios internos a staff', async () => {
      await service.findByRequestId(1, STAFF);
      expect(comentarioRepo.findByRequestId).toHaveBeenCalledWith(1, { includeInternal: true });
    });
  });

  describe('delete', () => {
    it('lanza NotFoundError si no existe', async () => {
      comentarioRepo.findById.mockResolvedValue(null);
      await expect(service.delete(999, REQUESTER)).rejects.toThrow(NotFoundError);
    });

    it('lanza ForbiddenError si no es el autor ni staff', async () => {
      const other = { id: 3, uuid: 'other-uuid', roles: ['STUDENT'] };
      await expect(service.delete(1, other)).rejects.toThrow(ForbiddenError);
    });

    it('permite al autor borrar su propio comentario', async () => {
      await service.delete(1, REQUESTER);
      expect(comentarioRepo.delete).toHaveBeenCalledWith(1);
    });
  });
});
