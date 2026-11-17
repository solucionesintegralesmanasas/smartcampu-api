jest.mock('../../src/config/elasticsearch', () => ({
  esClient: { index: jest.fn().mockResolvedValue({}) },
}));

const { ConflictError, ForbiddenError, NotFoundError } = require('../../src/core/exceptions');
const SolicitudService = require('../../src/modules/solicitud/solicitud.service');

const STATUSES = {
  pending: { id: 1, code: 'pending' },
  in_review: { id: 2, code: 'in_review' },
  approved: { id: 3, code: 'approved' },
  rejected: { id: 4, code: 'rejected' },
  closed: { id: 5, code: 'closed' },
};

function mockSolicitudRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 's1', statusId: STATUSES.pending.id, requesterUuid: 'requester-uuid',
    }),
    findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 's1', statusId: STATUSES.pending.id, requesterUuid: 'requester-uuid', assigneeUuid: null,
    }),
    updateStatus: jest.fn().mockImplementation((id, { statusId }) => Promise.resolve({
      id, uuid: 's1', statusId, requesterUuid: 'requester-uuid',
    })),
    ...overrides,
  };
}

function mockAuditoriaRepository(overrides = {}) {
  return {
    record: jest.fn().mockResolvedValue(undefined),
    findByRequestId: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mockTipoRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, slaDays: 5 }),
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
const STAFF = {
  id: 3, uuid: 'staff-uuid', nombre: 'Personal', roles: ['STAFF'],
};

const CREATE_DTO = {
  requestTypeId: 1,
  title: 'Certificado de notas',
  description: 'Necesito el certificado para una beca',
};

describe('SolicitudService', () => {
  let solicitudRepo;
  let auditoriaRepo;
  let tipoRepo;
  let estadoRepo;
  let notificationProducer;
  let service;

  beforeEach(() => {
    solicitudRepo = mockSolicitudRepository();
    auditoriaRepo = mockAuditoriaRepository();
    tipoRepo = mockTipoRepository();
    estadoRepo = mockEstadoRepository();
    notificationProducer = mockNotificationProducer();
    service = new SolicitudService(solicitudRepo, auditoriaRepo, tipoRepo, estadoRepo, notificationProducer);
  });

  describe('create', () => {
    it('lanza NotFoundError si el tipo de solicitud no existe', async () => {
      tipoRepo.findById.mockResolvedValue(null);
      await expect(service.create(CREATE_DTO, REQUESTER)).rejects.toThrow(NotFoundError);
      expect(solicitudRepo.create).not.toHaveBeenCalled();
    });

    it('crea la solicitud en pending con due_date calculada desde el SLA', async () => {
      await service.create(CREATE_DTO, REQUESTER);
      expect(solicitudRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusId: STATUSES.pending.id,
          requesterName: 'Ana Pérez',
          dueDate: expect.any(String),
        }),
      );
      expect(auditoriaRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ toStatusId: STATUSES.pending.id, fromStatusId: null }),
      );
    });

    it('crea la solicitud sin due_date si el tipo no tiene SLA', async () => {
      tipoRepo.findById.mockResolvedValue({ id: 1, slaDays: null });
      await service.create(CREATE_DTO, REQUESTER);
      expect(solicitudRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: null }),
      );
    });
  });

  describe('findById / access control', () => {
    it('lanza NotFoundError si no existe', async () => {
      solicitudRepo.findById.mockResolvedValue(null);
      await expect(service.findById(999, REQUESTER)).rejects.toThrow(NotFoundError);
    });

    it('permite al dueño ver su propia solicitud', async () => {
      const result = await service.findById(1, REQUESTER);
      expect(result.id).toBe(1);
    });

    it('permite al asignado ver la solicitud', async () => {
      solicitudRepo.findById.mockResolvedValue({
        id: 1, requesterUuid: 'requester-uuid', assigneeUuid: 'staff-uuid',
      });
      const result = await service.findById(1, STAFF);
      expect(result.id).toBe(1);
    });

    it('lanza ForbiddenError si otro usuario intenta ver una solicitud que no es suya', async () => {
      await expect(service.findById(1, OTHER_USER)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('findAll', () => {
    it('fuerza el filtro al propio usuario si no es admin/staff', async () => {
      await service.findAll(REQUESTER, {});
      expect(solicitudRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ requesterUuid: 'requester-uuid' }),
      );
    });

    it('no fuerza el filtro si es staff', async () => {
      await service.findAll(STAFF, {});
      expect(solicitudRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ requesterUuid: undefined }),
      );
    });
  });

  describe('transiciones de estado', () => {
    it('startReview: transiciona de pending a in_review y asigna al actor', async () => {
      const result = await service.startReview(1, STAFF);
      expect(result.statusId).toBe(STATUSES.in_review.id);
      expect(solicitudRepo.updateStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ assigneeUuid: 'staff-uuid' }),
      );
    });

    it('startReview: lanza ConflictError si no está en pending', async () => {
      solicitudRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.approved.id });
      await expect(service.startReview(1, STAFF)).rejects.toThrow(ConflictError);
    });

    it('approve: lanza ConflictError si no está en in_review', async () => {
      await expect(service.approve(1, STAFF, 'Todo en orden')).rejects.toThrow(ConflictError);
    });

    it('approve: transiciona de in_review a approved con notas de resolución', async () => {
      solicitudRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.in_review.id });
      const result = await service.approve(1, STAFF, 'Todo en orden');
      expect(result.statusId).toBe(STATUSES.approved.id);
      expect(solicitudRepo.updateStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ resolutionNotes: 'Todo en orden' }),
      );
    });

    it('reject: transiciona de in_review a rejected', async () => {
      solicitudRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.in_review.id });
      const result = await service.reject(1, STAFF, 'Documentación incompleta');
      expect(result.statusId).toBe(STATUSES.rejected.id);
    });

    it('close: transiciona de approved a closed', async () => {
      solicitudRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.approved.id });
      const result = await service.close(1, STAFF);
      expect(result.statusId).toBe(STATUSES.closed.id);
    });

    it('close: lanza ConflictError si está en pending', async () => {
      await expect(service.close(1, STAFF)).rejects.toThrow(ConflictError);
    });
  });

  describe('notificaciones', () => {
    it('notifica al solicitante al crear la solicitud', async () => {
      await service.create(CREATE_DTO, REQUESTER);
      expect(notificationProducer.notify).toHaveBeenCalledWith(
        'solicitud_creada',
        expect.objectContaining({ recipientUuid: 'requester-uuid' }),
      );
    });

    it('notifica al solicitante en cada transición de estado', async () => {
      await service.startReview(1, STAFF);
      expect(notificationProducer.notify).toHaveBeenCalledWith(
        'solicitud_in_review',
        expect.objectContaining({ recipientUuid: 'requester-uuid' }),
      );
    });

    it('no falla si no se inyectó un notificationProducer', async () => {
      const serviceSinNotificaciones = new SolicitudService(solicitudRepo, auditoriaRepo, tipoRepo, estadoRepo);
      await expect(serviceSinNotificaciones.create(CREATE_DTO, REQUESTER)).resolves.toBeDefined();
    });
  });
});
