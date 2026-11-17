const {
  ConflictError, ForbiddenError, NotFoundError,
} = require('../../src/core/exceptions');
const EventoService = require('../../src/modules/evento/evento.service');

const ORGANIZER = {
  id: 1, uuid: 'organizer-uuid', nombre: 'Ana Organizadora', roles: ['STUDENT'],
};
const STAFF = {
  id: 2, uuid: 'staff-uuid', nombre: 'Staff User', roles: ['STAFF'],
};
const OTHER_USER = {
  id: 3, uuid: 'other-uuid', nombre: 'Otro Usuario', roles: ['STUDENT'],
};

const BASE_EVENT = {
  id: 1,
  uuid: 'event-uuid-1',
  title: 'Feria de Ciencias',
  organizerUuid: ORGANIZER.uuid,
  statusId: 10,
};

function mockEventoRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue(BASE_EVENT),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findById: jest.fn().mockResolvedValue(BASE_EVENT),
    update: jest.fn().mockResolvedValue(BASE_EVENT),
    delete: jest.fn().mockResolvedValue(true),
    updateStatus: jest.fn().mockResolvedValue({ ...BASE_EVENT, statusId: 20 }),
    ...overrides,
  };
}

function mockCategoriaRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 5, code: 'ACADEMICO' }),
    ...overrides,
  };
}

function mockEstadoRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockImplementation((code) => {
      const statuses = {
        draft: { id: 10, code: 'draft' },
        published: { id: 20, code: 'published' },
        ongoing: { id: 30, code: 'ongoing' },
        completed: { id: 40, code: 'completed' },
        cancelled: { id: 50, code: 'cancelled' },
      };
      return Promise.resolve(statuses[code] || null);
    }),
    findById: jest.fn().mockResolvedValue({ id: 10, code: 'draft' }),
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

function mockNotificationProducer() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

describe('EventoService', () => {
  let eventoRepo;
  let categoriaRepo;
  let estadoRepo;
  let notificationProducer;
  let service;

  beforeEach(() => {
    eventoRepo = mockEventoRepository();
    categoriaRepo = mockCategoriaRepository();
    estadoRepo = mockEstadoRepository();
    notificationProducer = mockNotificationProducer();
    service = new EventoService(eventoRepo, categoriaRepo, estadoRepo, mockRedis(), notificationProducer);
  });

  describe('create', () => {
    it('lanza NotFoundError si la categoría no existe', async () => {
      categoriaRepo.findById.mockResolvedValue(null);
      await expect(
        service.create({ categoryId: 99, title: 'Feria' }, ORGANIZER),
      ).rejects.toThrow(NotFoundError);
    });

    it('lanza NotFoundError si el estado draft no está configurado', async () => {
      estadoRepo.findByCode.mockResolvedValue(null);
      await expect(
        service.create({ categoryId: 5, title: 'Feria' }, ORGANIZER),
      ).rejects.toThrow(NotFoundError);
    });

    it('crea el evento con statusId de draft y el organizador como snapshot', async () => {
      await service.create({ categoryId: 5, title: 'Feria de Ciencias' }, ORGANIZER);
      expect(eventoRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        categoryId: 5,
        title: 'Feria de Ciencias',
        statusId: 10,
        organizerUuid: ORGANIZER.uuid,
        organizerName: ORGANIZER.nombre,
        slug: expect.stringMatching(/^feria-de-ciencias-/),
      }));
    });
  });

  describe('findById', () => {
    it('lanza NotFoundError si el evento no existe', async () => {
      eventoRepo.findById.mockResolvedValue(null);
      await expect(service.findById(99)).rejects.toThrow(NotFoundError);
    });
  });

  describe('assertCanManage', () => {
    it('permite al organizador', () => {
      expect(() => service.assertCanManage(BASE_EVENT, ORGANIZER)).not.toThrow();
    });

    it('permite a un usuario STAFF', () => {
      expect(() => service.assertCanManage(BASE_EVENT, STAFF)).not.toThrow();
    });

    it('rechaza a un usuario que no es organizador ni staff', () => {
      expect(() => service.assertCanManage(BASE_EVENT, OTHER_USER)).toThrow(ForbiddenError);
    });
  });

  describe('update / delete', () => {
    it('lanza ForbiddenError si un tercero intenta actualizar', async () => {
      await expect(service.update(1, { title: 'x' }, OTHER_USER)).rejects.toThrow(ForbiddenError);
    });

    it('permite actualizar al organizador', async () => {
      await service.update(1, { title: 'Nuevo título' }, ORGANIZER);
      expect(eventoRepo.update).toHaveBeenCalledWith(1, { title: 'Nuevo título' });
    });

    it('lanza ForbiddenError si un tercero intenta borrar', async () => {
      await expect(service.delete(1, OTHER_USER)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('transiciones de estado', () => {
    it('publish falla si el evento no está en draft', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 20, code: 'published' });
      await expect(service.publish(1, ORGANIZER)).rejects.toThrow(ConflictError);
    });

    it('publish transiciona de draft a published', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 10, code: 'draft' });
      await service.publish(1, ORGANIZER);
      expect(eventoRepo.updateStatus).toHaveBeenCalledWith(1, 20);
    });

    it('start falla si el evento no está publicado', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 10, code: 'draft' });
      await expect(service.start(1, ORGANIZER)).rejects.toThrow(ConflictError);
    });

    it('start transiciona de published a ongoing', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 20, code: 'published' });
      await service.start(1, ORGANIZER);
      expect(eventoRepo.updateStatus).toHaveBeenCalledWith(1, 30);
    });

    it('complete transiciona de ongoing a completed', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 30, code: 'ongoing' });
      await service.complete(1, ORGANIZER);
      expect(eventoRepo.updateStatus).toHaveBeenCalledWith(1, 40);
    });

    it('cancel funciona desde draft, published u ongoing', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 30, code: 'ongoing' });
      await service.cancel(1, ORGANIZER);
      expect(eventoRepo.updateStatus).toHaveBeenCalledWith(1, 50);
    });

    it('cancel falla si el evento ya está completed', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 40, code: 'completed' });
      await expect(service.cancel(1, ORGANIZER)).rejects.toThrow(ConflictError);
    });

    it('lanza ForbiddenError si un tercero intenta transicionar', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 10, code: 'draft' });
      await expect(service.publish(1, OTHER_USER)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('notificaciones', () => {
    it('notifica al organizador cuando el evento se publica', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 10, code: 'draft' });
      await service.publish(1, ORGANIZER);
      expect(notificationProducer.notify).toHaveBeenCalledWith(
        'evento_publicado',
        expect.objectContaining({ recipientUuid: ORGANIZER.uuid }),
      );
    });

    it('no falla si no se inyectó un notificationProducer', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 10, code: 'draft' });
      const serviceSinNotificaciones = new EventoService(eventoRepo, categoriaRepo, estadoRepo, mockRedis());
      await expect(serviceSinNotificaciones.publish(1, ORGANIZER)).resolves.toBeDefined();
    });
  });
});
