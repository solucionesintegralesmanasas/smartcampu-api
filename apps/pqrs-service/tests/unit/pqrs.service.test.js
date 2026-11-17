jest.mock('../../src/config/elasticsearch', () => ({
  esClient: { index: jest.fn().mockResolvedValue({}) },
}));

const { ConflictError, ForbiddenError, NotFoundError } = require('../../src/core/exceptions');
const PqrsService = require('../../src/modules/pqrs/pqrs.service');

const STATUSES = {
  pending: { id: 1, code: 'pending' },
  in_review: { id: 2, code: 'in_review' },
  responded: { id: 3, code: 'responded' },
  closed: { id: 4, code: 'closed' },
};

function mockPqrsRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue({
      id: 1, uuid: 'p1', statusId: STATUSES.pending.id, requesterUuid: 'requester-uuid',
    }),
    findAll: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    findById: jest.fn().mockResolvedValue({
      id: 1, uuid: 'p1', statusId: STATUSES.pending.id, requesterUuid: 'requester-uuid', assigneeUuid: null,
    }),
    findByTicketNumber: jest.fn().mockResolvedValue({
      id: 1, uuid: 'p1', ticketNumber: 'PQRS-2026-ABCD', statusId: STATUSES.pending.id,
    }),
    updateStatus: jest.fn().mockImplementation((id, { statusId }) => Promise.resolve({
      id, uuid: 'p1', statusId, requesterUuid: 'requester-uuid',
    })),
    ...overrides,
  };
}

function mockAuditoriaRepository(overrides = {}) {
  return {
    record: jest.fn().mockResolvedValue(undefined),
    findByPqrsId: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mockRespuestaRepository(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue({ id: 1, pqrsId: 1, body: 'Respuesta oficial' }),
    findByPqrsId: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function mockTipoRepository(overrides = {}) {
  return {
    findById: jest.fn().mockResolvedValue({ id: 1, slaDays: 15 }),
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
  typeId: 1,
  subject: 'Ruido excesivo en la biblioteca',
  description: 'Durante la jornada de exámenes hay ruido constante',
};

describe('PqrsService', () => {
  let pqrsRepo;
  let auditoriaRepo;
  let respuestaRepo;
  let tipoRepo;
  let estadoRepo;
  let notificationProducer;
  let service;

  beforeEach(() => {
    pqrsRepo = mockPqrsRepository();
    auditoriaRepo = mockAuditoriaRepository();
    respuestaRepo = mockRespuestaRepository();
    tipoRepo = mockTipoRepository();
    estadoRepo = mockEstadoRepository();
    notificationProducer = mockNotificationProducer();
    service = new PqrsService(
      pqrsRepo,
      auditoriaRepo,
      respuestaRepo,
      tipoRepo,
      estadoRepo,
      notificationProducer,
    );
  });

  describe('create', () => {
    it('lanza NotFoundError si el tipo de PQRS no existe', async () => {
      tipoRepo.findById.mockResolvedValue(null);
      await expect(service.create(CREATE_DTO, REQUESTER)).rejects.toThrow(NotFoundError);
      expect(pqrsRepo.create).not.toHaveBeenCalled();
    });

    it('crea la PQRS en pending con due_date calculada desde el SLA del tipo', async () => {
      await service.create(CREATE_DTO, REQUESTER);
      expect(pqrsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusId: STATUSES.pending.id,
          requesterUuid: 'requester-uuid',
          requesterName: 'Ana Pérez',
          isAnonymous: false,
          dueDate: expect.any(String),
        }),
      );
      expect(auditoriaRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ toStatusId: STATUSES.pending.id, fromStatusId: null }),
      );
    });

    it('no guarda la identidad del solicitante ni registra auditoría si es anónima', async () => {
      await service.create({ ...CREATE_DTO, isAnonymous: true }, REQUESTER);
      expect(pqrsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isAnonymous: true,
          requesterUuid: null,
          requesterName: null,
        }),
      );
      expect(auditoriaRepo.record).not.toHaveBeenCalled();
    });
  });

  describe('findById / access control', () => {
    it('lanza NotFoundError si no existe', async () => {
      pqrsRepo.findById.mockResolvedValue(null);
      await expect(service.findById(999, REQUESTER)).rejects.toThrow(NotFoundError);
    });

    it('permite al dueño ver su propia PQRS', async () => {
      const result = await service.findById(1, REQUESTER);
      expect(result.id).toBe(1);
    });

    it('permite al asignado ver la PQRS', async () => {
      pqrsRepo.findById.mockResolvedValue({
        id: 1, requesterUuid: 'requester-uuid', assigneeUuid: 'staff-uuid',
      });
      const result = await service.findById(1, STAFF);
      expect(result.id).toBe(1);
    });

    it('lanza ForbiddenError si otro usuario intenta ver una PQRS que no es suya', async () => {
      await expect(service.findById(1, OTHER_USER)).rejects.toThrow(ForbiddenError);
    });

    it('lanza ForbiddenError si el propio solicitante anónimo intenta verla por id', async () => {
      pqrsRepo.findById.mockResolvedValue({ id: 1, requesterUuid: null, assigneeUuid: null });
      await expect(service.findById(1, REQUESTER)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('findByTicketNumber', () => {
    it('no exige ninguna relación de propiedad: el ticket es la credencial', async () => {
      const result = await service.findByTicketNumber('PQRS-2026-ABCD');
      expect(result.ticketNumber).toBe('PQRS-2026-ABCD');
    });

    it('lanza NotFoundError si el ticket no existe', async () => {
      pqrsRepo.findByTicketNumber.mockResolvedValue(null);
      await expect(service.findByTicketNumber('PQRS-0000-XXXX')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    it('fuerza el filtro al propio usuario si no es admin/staff', async () => {
      await service.findAll(REQUESTER, {});
      expect(pqrsRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ requesterUuid: 'requester-uuid' }),
      );
    });

    it('no fuerza el filtro si es staff', async () => {
      await service.findAll(STAFF, {});
      expect(pqrsRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ requesterUuid: undefined }),
      );
    });
  });

  describe('transiciones de estado', () => {
    it('startReview: transiciona de pending a in_review y asigna al actor', async () => {
      const result = await service.startReview(1, STAFF);
      expect(result.statusId).toBe(STATUSES.in_review.id);
      expect(pqrsRepo.updateStatus).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ assigneeUuid: 'staff-uuid' }),
      );
    });

    it('startReview: lanza ConflictError si no está en pending', async () => {
      pqrsRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.responded.id });
      await expect(service.startReview(1, STAFF)).rejects.toThrow(ConflictError);
    });

    it('respond: crea la respuesta oficial y transiciona a responded', async () => {
      const { pqrs, respuesta } = await service.respond(1, STAFF, { body: 'Respuesta oficial' });
      expect(pqrs.statusId).toBe(STATUSES.responded.id);
      expect(respuestaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pqrsId: 1, authorUuid: 'staff-uuid', body: 'Respuesta oficial' }),
      );
      expect(respuesta).toEqual({ id: 1, pqrsId: 1, body: 'Respuesta oficial' });
    });

    it('respond: funciona tanto desde pending como desde in_review', async () => {
      pqrsRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.in_review.id });
      const { pqrs } = await service.respond(1, STAFF, { body: 'Respuesta oficial' });
      expect(pqrs.statusId).toBe(STATUSES.responded.id);
    });

    it('respond: lanza ConflictError si ya fue respondida', async () => {
      pqrsRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.responded.id });
      await expect(service.respond(1, STAFF, { body: 'x' })).rejects.toThrow(ConflictError);
      expect(respuestaRepo.create).not.toHaveBeenCalled();
    });

    it('close: transiciona de responded a closed', async () => {
      pqrsRepo.findById.mockResolvedValue({ id: 1, statusId: STATUSES.responded.id });
      const result = await service.close(1, STAFF);
      expect(result.statusId).toBe(STATUSES.closed.id);
    });

    it('close: lanza ConflictError si está en pending', async () => {
      await expect(service.close(1, STAFF)).rejects.toThrow(ConflictError);
    });
  });

  describe('notificaciones', () => {
    it('notifica al solicitante al radicar una PQRS no anónima', async () => {
      await service.create(CREATE_DTO, REQUESTER);
      expect(notificationProducer.notify).toHaveBeenCalledWith(
        'pqrs_creada',
        expect.objectContaining({ recipientUuid: 'requester-uuid' }),
      );
    });

    it('no notifica al radicar una PQRS anónima', async () => {
      await service.create({ ...CREATE_DTO, isAnonymous: true }, REQUESTER);
      expect(notificationProducer.notify).not.toHaveBeenCalled();
    });

    it('notifica al responder', async () => {
      await service.respond(1, STAFF, { body: 'Respuesta oficial' });
      expect(notificationProducer.notify).toHaveBeenCalledWith(
        'pqrs_responded',
        expect.objectContaining({ recipientUuid: 'requester-uuid' }),
      );
    });

    it('no falla si no se inyectó un notificationProducer', async () => {
      const serviceSinNotificaciones = new PqrsService(
        pqrsRepo,
        auditoriaRepo,
        respuestaRepo,
        tipoRepo,
        estadoRepo,
      );
      await expect(
        serviceSinNotificaciones.create(CREATE_DTO, REQUESTER),
      ).resolves.toBeDefined();
    });
  });
});
