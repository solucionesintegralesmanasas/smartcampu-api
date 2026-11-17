jest.mock('../../src/config/elasticsearch', () => ({
  esClient: { index: jest.fn().mockResolvedValue({}) },
}));

const { ForbiddenError, NotFoundError } = require('../../src/core/exceptions');
const NotificacionService = require('../../src/modules/notificacion/notificacion.service');

function mockRepository(overrides = {}) {
  return {
    create: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 1, uuid: 'n1', ...dto })),
    findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    countUnread: jest.fn().mockResolvedValue(3),
    findById: jest.fn().mockResolvedValue({ id: 1, recipientUuid: 'user-uuid', status: 'delivered' }),
    markRead: jest.fn().mockResolvedValue({ id: 1, status: 'read' }),
    markAllRead: jest.fn().mockResolvedValue(5),
    ...overrides,
  };
}

const USER = {
  id: 1, uuid: 'user-uuid', nombre: 'Ana', roles: ['STUDENT'],
};
const OTHER_USER = {
  id: 2, uuid: 'other-uuid', nombre: 'Otro', roles: ['STUDENT'],
};

describe('NotificacionService', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = mockRepository();
    service = new NotificacionService(repo);
  });

  describe('create', () => {
    it('marca in_app como delivered de inmediato', async () => {
      const result = await service.create({ recipientUuid: 'user-uuid', body: 'x' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'in_app', status: 'delivered' }),
      );
      expect(result.status).toBe('delivered');
    });

    it('deja en queued los canales que no son in_app (sin worker de envío real)', async () => {
      await service.create({ recipientUuid: 'user-uuid', body: 'x', channel: 'email' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'email', status: 'queued', deliveredAt: null }),
      );
    });
  });

  describe('findMine', () => {
    it('siempre filtra por el uuid del usuario autenticado', async () => {
      await service.findMine(USER, { page: 1, limit: 10 });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUuid: 'user-uuid' }),
      );
    });
  });

  describe('countUnread', () => {
    it('devuelve el total de no leídas', async () => {
      const result = await service.countUnread(USER);
      expect(result).toEqual({ total: 3 });
    });
  });

  describe('markRead', () => {
    it('lanza NotFoundError si no existe', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.markRead(99, USER)).rejects.toThrow(NotFoundError);
    });

    it('lanza ForbiddenError si no es el destinatario', async () => {
      await expect(service.markRead(1, OTHER_USER)).rejects.toThrow(ForbiddenError);
    });

    it('marca como leída si es el destinatario', async () => {
      await service.markRead(1, USER);
      expect(repo.markRead).toHaveBeenCalledWith(1);
    });
  });

  describe('markAllRead', () => {
    it('devuelve el total actualizado', async () => {
      const result = await service.markAllRead(USER);
      expect(result).toEqual({ total: 5 });
      expect(repo.markAllRead).toHaveBeenCalledWith('user-uuid');
    });
  });
});
