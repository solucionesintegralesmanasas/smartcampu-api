const {
  ConflictError, ForbiddenError, NotFoundError,
} = require('../../src/core/exceptions');
const InscripcionService = require('../../src/modules/inscripcion/inscripcion.service');

const STUDENT = {
  id: 1, uuid: 'student-uuid', nombre: 'Juan Pérez', roles: ['STUDENT'],
};
const STAFF = {
  id: 2, uuid: 'staff-uuid', nombre: 'Staff User', roles: ['STAFF'],
};

const PUBLISHED_EVENT = {
  id: 1,
  requiresRegistration: true,
  statusId: 20,
  registrationDeadline: null,
  maxCapacity: 2,
};

function mockInscripcionRepository(overrides = {}) {
  return {
    findByEventAndRegistrant: jest.fn().mockResolvedValue(null),
    countByStatus: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation((dto) => Promise.resolve({
      id: 1, status: dto.status, registrantUuid: dto.registrantUuid, registrantName: dto.registrantName,
    })),
    updateStatus: jest.fn().mockImplementation((id, dto) => Promise.resolve({
      id, registrantUuid: `registrant-of-${id}`, ...dto,
    })),
    findById: jest.fn().mockResolvedValue({ id: 1, status: 'confirmed' }),
    findByEventId: jest.fn().mockResolvedValue([]),
    findOldestWaitlisted: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function mockEventoRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue(PUBLISHED_EVENT),
    ...overrides,
  };
}

function mockEstadoRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 20, code: 'published' }),
    ...overrides,
  };
}

function mockNotificationProducer() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

describe('InscripcionService', () => {
  let inscripcionRepo;
  let eventoRepo;
  let estadoRepo;
  let notificationProducer;
  let service;

  beforeEach(() => {
    inscripcionRepo = mockInscripcionRepository();
    eventoRepo = mockEventoRepository();
    estadoRepo = mockEstadoRepository();
    notificationProducer = mockNotificationProducer();
    service = new InscripcionService(inscripcionRepo, eventoRepo, estadoRepo, notificationProducer);
  });

  describe('register', () => {
    it('lanza NotFoundError si el evento no existe', async () => {
      eventoRepo.findById.mockResolvedValue(null);
      await expect(service.register(99, STUDENT)).rejects.toThrow(NotFoundError);
    });

    it('lanza ConflictError si el evento no requiere inscripción', async () => {
      eventoRepo.findById.mockResolvedValue({ ...PUBLISHED_EVENT, requiresRegistration: false });
      await expect(service.register(1, STUDENT)).rejects.toThrow(ConflictError);
    });

    it('lanza ConflictError si el evento no está publicado', async () => {
      estadoRepo.findById.mockResolvedValue({ id: 10, code: 'draft' });
      await expect(service.register(1, STUDENT)).rejects.toThrow(ConflictError);
    });

    it('lanza ConflictError si venció la fecha límite de inscripción', async () => {
      eventoRepo.findById.mockResolvedValue({
        ...PUBLISHED_EVENT,
        registrationDeadline: new Date(Date.now() - 86400000).toISOString(),
      });
      await expect(service.register(1, STUDENT)).rejects.toThrow(ConflictError);
    });

    it('lanza ConflictError si ya está inscrito y activo', async () => {
      inscripcionRepo.findByEventAndRegistrant.mockResolvedValue({ id: 5, status: 'confirmed' });
      await expect(service.register(1, STUDENT)).rejects.toThrow(ConflictError);
    });

    it('confirma la inscripción si hay cupo disponible', async () => {
      inscripcionRepo.countByStatus.mockResolvedValue(0);
      await service.register(1, STUDENT);
      expect(inscripcionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        eventId: 1,
        registrantUuid: STUDENT.uuid,
        registrantName: STUDENT.nombre,
        status: 'confirmed',
      }));
    });

    it('pone en lista de espera si no hay cupo disponible', async () => {
      inscripcionRepo.countByStatus.mockResolvedValue(2);
      await service.register(1, STUDENT);
      expect(inscripcionRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'waitlisted',
      }));
    });

    it('reactiva una inscripción cancelada en vez de crear una nueva', async () => {
      inscripcionRepo.findByEventAndRegistrant.mockResolvedValue({ id: 7, status: 'cancelled' });
      await service.register(1, STUDENT);
      expect(inscripcionRepo.updateStatus).toHaveBeenCalledWith(7, expect.objectContaining({
        status: 'confirmed',
      }));
      expect(inscripcionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('lanza NotFoundError si no está inscrito', async () => {
      inscripcionRepo.findByEventAndRegistrant.mockResolvedValue(null);
      await expect(service.cancel(1, STUDENT)).rejects.toThrow(NotFoundError);
    });

    it('lanza ConflictError si ya estaba cancelada', async () => {
      inscripcionRepo.findByEventAndRegistrant.mockResolvedValue({ id: 1, status: 'cancelled' });
      await expect(service.cancel(1, STUDENT)).rejects.toThrow(ConflictError);
    });

    it('promueve automáticamente a la persona más antigua en lista de espera', async () => {
      inscripcionRepo.findByEventAndRegistrant.mockResolvedValue({ id: 1, status: 'confirmed' });
      inscripcionRepo.findOldestWaitlisted.mockResolvedValue({ id: 8, status: 'waitlisted' });
      await service.cancel(1, STUDENT);
      expect(inscripcionRepo.updateStatus).toHaveBeenCalledWith(8, expect.objectContaining({
        status: 'confirmed',
      }));
    });

    it('no promueve a nadie si no hay lista de espera', async () => {
      inscripcionRepo.findByEventAndRegistrant.mockResolvedValue({ id: 1, status: 'confirmed' });
      inscripcionRepo.findOldestWaitlisted.mockResolvedValue(null);
      await service.cancel(1, STUDENT);
      expect(inscripcionRepo.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('no promueve a nadie si la inscripción cancelada estaba en lista de espera', async () => {
      inscripcionRepo.findByEventAndRegistrant.mockResolvedValue({ id: 1, status: 'waitlisted' });
      await service.cancel(1, STUDENT);
      expect(inscripcionRepo.findOldestWaitlisted).not.toHaveBeenCalled();
    });
  });

  describe('checkIn', () => {
    it('lanza ForbiddenError si el actor no es staff', async () => {
      await expect(service.checkIn(1, STUDENT)).rejects.toThrow(ForbiddenError);
    });

    it('lanza NotFoundError si la inscripción no existe', async () => {
      inscripcionRepo.findById.mockResolvedValue(null);
      await expect(service.checkIn(99, STAFF)).rejects.toThrow(NotFoundError);
    });

    it('lanza ConflictError si la inscripción no está confirmada', async () => {
      inscripcionRepo.findById.mockResolvedValue({ id: 1, status: 'waitlisted' });
      await expect(service.checkIn(1, STAFF)).rejects.toThrow(ConflictError);
    });

    it('marca como attended una inscripción confirmada', async () => {
      inscripcionRepo.findById.mockResolvedValue({ id: 1, status: 'confirmed' });
      await service.checkIn(1, STAFF);
      expect(inscripcionRepo.updateStatus).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'attended',
      }));
    });
  });

  describe('findMine / findByEventId', () => {
    it('findMine lanza NotFoundError si no está inscrito', async () => {
      inscripcionRepo.findByEventAndRegistrant.mockResolvedValue(null);
      await expect(service.findMine(1, STUDENT)).rejects.toThrow(NotFoundError);
    });

    it('findByEventId lanza NotFoundError si el evento no existe', async () => {
      eventoRepo.findById.mockResolvedValue(null);
      await expect(service.findByEventId(99)).rejects.toThrow(NotFoundError);
    });
  });

  describe('notificaciones', () => {
    it('notifica confirmación si hay cupo disponible', async () => {
      inscripcionRepo.countByStatus.mockResolvedValue(0);
      await service.register(1, STUDENT);
      expect(notificationProducer.notify).toHaveBeenCalledWith(
        'inscripcion_confirmada',
        expect.objectContaining({ recipientUuid: STUDENT.uuid }),
      );
    });

    it('notifica lista de espera si no hay cupo disponible', async () => {
      inscripcionRepo.countByStatus.mockResolvedValue(2);
      await service.register(1, STUDENT);
      expect(notificationProducer.notify).toHaveBeenCalledWith(
        'inscripcion_lista_espera',
        expect.objectContaining({ recipientUuid: STUDENT.uuid }),
      );
    });

    it('notifica al promovido desde lista de espera al cancelar un cupo confirmado', async () => {
      inscripcionRepo.findByEventAndRegistrant.mockResolvedValue({ id: 1, status: 'confirmed' });
      inscripcionRepo.findOldestWaitlisted.mockResolvedValue({
        id: 8, status: 'waitlisted', registrantUuid: 'other-student-uuid',
      });
      inscripcionRepo.updateStatus.mockImplementation((id, dto) => Promise.resolve({
        id, registrantUuid: id === 8 ? 'other-student-uuid' : 'student-uuid', ...dto,
      }));
      await service.cancel(1, STUDENT);
      expect(notificationProducer.notify).toHaveBeenCalledWith(
        'inscripcion_promovida',
        expect.objectContaining({ recipientUuid: 'other-student-uuid' }),
      );
    });

    it('no falla si no se inyectó un notificationProducer', async () => {
      const serviceSinNotificaciones = new InscripcionService(inscripcionRepo, eventoRepo, estadoRepo);
      await expect(serviceSinNotificaciones.register(1, STUDENT)).resolves.toBeDefined();
    });
  });
});
