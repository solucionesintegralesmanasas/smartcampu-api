jest.mock('../../src/config/elasticsearch', () => ({
  esClient: { index: jest.fn().mockResolvedValue({}) },
}));

const mockResourceClient = {
  getResource: jest.fn(),
  checkResourceAvailability: jest.fn(),
};

jest.mock('../../src/clients/resource.client', () => mockResourceClient);

const { ConflictError, ForbiddenError, NotFoundError } = require('../../src/core/exceptions');
const ReservaService = require('../../src/modules/reserva/reserva.service');

const STATUSES = {
  pending: { id: 1, code: 'pending' },
  approved: { id: 2, code: 'approved' },
  rejected: { id: 3, code: 'rejected' },
  confirmed: { id: 4, code: 'confirmed' },
  cancelled: { id: 5, code: 'cancelled' },
  completed: { id: 6, code: 'completed' },
};

function mockReservaRepository(overrides = {}) {
  return {
    findOverlapping: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 'b1', statusId: STATUSES.pending.id, requesterUuid: 'requester-uuid',
    }),
    findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 'b1', statusId: STATUSES.pending.id, requesterUuid: 'requester-uuid',
    }),
    updateStatus: jest.fn().mockImplementation((id, { statusId }) => Promise.resolve({
      id, uuid: 'b1', statusId, requesterUuid: 'requester-uuid',
    })),
    ...overrides,
  };
}

function mockAuditoriaRepository(overrides = {}) {
  return {
    record: jest.fn().mockResolvedValue(undefined),
    findByBookingId: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mockTipoRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, requiresApproval: true }),
    ...overrides,
  };
}

function mockEstadoRepository(overrides = {}) {
  return {
    findByCode: jest.fn().mockImplementation((code) => Promise.resolve(STATUSES[code] ?? null)),
    findById: jest.fn().mockImplementation((id) => Promise.resolve(
      Object.values(STATUSES).find((s) => s.id === id) ?? null,
    )),
    ...overrides,
  };
}

function mockNotificationProducer() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

const REQUESTER = {
  id: 1, uuid: 'requester-uuid', nombre: 'Ana Pérez', roles: ['STUDENT'],
};
const OTHER_USER = {
  id: 2, uuid: 'other-uuid', nombre: 'Otro Usuario', roles: ['STUDENT'],
};
const ADMIN = {
  id: 3, uuid: 'admin-uuid', nombre: 'Admin', roles: ['ADMIN'],
};

const CREATE_DTO = {
  bookingTypeId: 1,
  resourceId: 10,
  title: 'Clase de refuerzo',
  bookingDate: '2026-02-02',
  startTime: '09:00',
  endTime: '10:00',
};

describe('ReservaService', () => {
  let reservaRepo;
  let auditoriaRepo;
  let tipoRepo;
  let estadoRepo;
  let notificationProducer;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    reservaRepo = mockReservaRepository();
    auditoriaRepo = mockAuditoriaRepository();
    tipoRepo = mockTipoRepository();
    estadoRepo = mockEstadoRepository();
    notificationProducer = mockNotificationProducer();
    service = new ReservaService(reservaRepo, auditoriaRepo, tipoRepo, estadoRepo, notificationProducer);

    mockResourceClient.getResource.mockResolvedValue({ id: 10, uuid: 'resource-uuid', name: 'Aula 101' });
    mockResourceClient.checkResourceAvailability.mockResolvedValue({ available: true });
  });

  describe('create', () => {
    it('lanza NotFoundError si el tipo de reserva no existe', async () => {
      tipoRepo.findById.mockResolvedValue(null);
      await expect(service.create(CREATE_DTO, REQUESTER)).rejects.toThrow(NotFoundError);
      expect(mockResourceClient.getResource).not.toHaveBeenCalled();
    });

    it('lanza NotFoundError si el recurso no existe en resource-service', async () => {
      mockResourceClient.getResource.mockResolvedValue(null);
      await expect(service.create(CREATE_DTO, REQUESTER)).rejects.toThrow(NotFoundError);
      expect(reservaRepo.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictError si el recurso no está disponible operativamente', async () => {
      mockResourceClient.checkResourceAvailability.mockResolvedValue({
        available: false, reason: 'outside_operating_hours',
      });
      await expect(service.create(CREATE_DTO, REQUESTER)).rejects.toThrow(ConflictError);
      expect(reservaRepo.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictError si ya hay una reserva activa que se traslapa', async () => {
      reservaRepo.findOverlapping.mockResolvedValue({ id: 99 });
      await expect(service.create(CREATE_DTO, REQUESTER)).rejects.toThrow(ConflictError);
      expect(reservaRepo.create).not.toHaveBeenCalled();
    });

    it('crea la reserva en pending si el tipo requiere aprobación', async () => {
      await service.create(CREATE_DTO, REQUESTER);
      expect(reservaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: STATUSES.pending.id, requesterName: 'Ana Pérez' }),
      );
      expect(auditoriaRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ toStatusId: STATUSES.pending.id, fromStatusId: null }),
      );
    });

    it('crea la reserva ya aprobada si el tipo no requiere aprobación', async () => {
      tipoRepo.findById.mockResolvedValue({ id: 1, requiresApproval: false });
      await service.create(CREATE_DTO, REQUESTER);
      expect(reservaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ statusId: STATUSES.approved.id }),
      );
    });
  });

  describe('findById / access control', () => {
    it('lanza NotFoundError si no existe', async () => {
      reservaRepo.findById.mockResolvedValue(null);
      await expect(service.findById(999, REQUESTER)).rejects.toThrow(NotFoundError);
    });

    it('permite al dueño ver su propia reserva', async () => {
      const result = await service.findById(1, REQUESTER);
      expect(result.id).toBe(1);
    });

    it('permite a un admin ver una reserva ajena', async () => {
      const result = await service.findById(1, ADMIN);
      expect(result.id).toBe(1);
    });

    it('lanza ForbiddenError si otro usuario intenta ver una reserva que no es suya', async () => {
      await expect(service.findById(1, OTHER_USER)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('findAll', () => {
    it('fuerza el filtro al propio usuario si no es admin', async () => {
      await service.findAll(REQUESTER, {});
      expect(reservaRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ requesterUuid: 'requester-uuid' }),
      );
    });

    it('no fuerza el filtro si es admin', async () => {
      await service.findAll(ADMIN, {});
      expect(reservaRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ requesterUuid: undefined }),
      );
    });
  });

  describe('transiciones de estado', () => {
    it('approve: transiciona de pending a approved', async () => {
      const result = await service.approve(1, ADMIN);
      expect(result.statusId).toBe(STATUSES.approved.id);
      expect(auditoriaRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatusId: STATUSES.pending.id, toStatusId: STATUSES.approved.id,
        }),
      );
    });

    it('approve: lanza ConflictError si la reserva no está en pending', async () => {
      reservaRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.approved.id });
      await expect(service.approve(1, ADMIN)).rejects.toThrow(ConflictError);
    });

    it('confirm: lanza ConflictError si la reserva no está en approved', async () => {
      reservaRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.pending.id });
      await expect(service.confirm(1, ADMIN)).rejects.toThrow(ConflictError);
    });

    it('confirm: transiciona de approved a confirmed', async () => {
      reservaRepo.findById.mockResolvedValue({
        id: 1, statusId: STATUSES.approved.id, requesterUuid: 'requester-uuid',
      });
      const result = await service.confirm(1, ADMIN);
      expect(result.statusId).toBe(STATUSES.confirmed.id);
    });

    it('cancel: lanza ForbiddenError si no es el dueño ni admin', async () => {
      await expect(service.cancel(1, OTHER_USER, 'ya no lo necesito')).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('cancel: el dueño puede cancelar su propia reserva pendiente', async () => {
      const result = await service.cancel(1, REQUESTER, 'ya no lo necesito');
      expect(result.statusId).toBe(STATUSES.cancelled.id);
    });

    it('complete: lanza ConflictError si la reserva no está confirmed', async () => {
      await expect(service.complete(1, ADMIN)).rejects.toThrow(ConflictError);
    });
  });

  describe('notificaciones', () => {
    it('notifica al solicitante en cada transición de estado', async () => {
      await service.approve(1, ADMIN);
      expect(notificationProducer.notify).toHaveBeenCalledWith(
        'reserva_approved',
        expect.objectContaining({ recipientUuid: 'requester-uuid' }),
      );
    });

    it('no falla si no se inyectó un notificationProducer', async () => {
      const serviceSinNotificaciones = new ReservaService(reservaRepo, auditoriaRepo, tipoRepo, estadoRepo);
      await expect(serviceSinNotificaciones.approve(1, ADMIN)).resolves.toBeDefined();
    });

    it('no interrumpe la transición si notify() falla', async () => {
      notificationProducer.notify.mockRejectedValue(new Error('redis down'));
      await expect(service.approve(1, ADMIN)).resolves.toBeDefined();
    });
  });
});
