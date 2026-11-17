const {
  DomainEventsConsumer,
  EVENT_DEFINITIONS,
} = require('../../src/jobs/consumers/domain-events.consumer');

function mockNotificacionService(overrides = {}) {
  return {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    ...overrides,
  };
}

describe('DomainEventsConsumer', () => {
  let notificacionService;
  let consumer;

  beforeEach(() => {
    notificacionService = mockNotificacionService();
    consumer = new DomainEventsConsumer(notificacionService);
  });

  it('descarta el evento sin crear una notificación si no trae recipientUuid (ej. PQRS anónima)', async () => {
    const result = await consumer.handle('pqrs_creada', { referenceLabel: 'PQRS-2026-AAAA' });
    expect(result).toEqual({ skipped: true, reason: 'no_recipient' });
    expect(notificacionService.create).not.toHaveBeenCalled();
  });

  it('descarta silenciosamente un eventType desconocido', async () => {
    const result = await consumer.handle('tipo_inexistente', { recipientUuid: 'u1' });
    expect(result).toEqual({ skipped: true, reason: 'unknown_event_type' });
    expect(notificacionService.create).not.toHaveBeenCalled();
  });

  it('crea una notificación in_app para un evento de reserva reconocido', async () => {
    const result = await consumer.handle('reserva_approved', {
      recipientUuid: 'requester-uuid',
      entityId: 5,
      entityUuid: 'booking-uuid',
      referenceLabel: 'BK-2026-ABCD',
    });
    expect(notificacionService.create).toHaveBeenCalledWith(expect.objectContaining({
      recipientUuid: 'requester-uuid',
      channel: 'in_app',
      subject: 'Reserva aprobada',
      body: 'Tu reserva BK-2026-ABCD fue aprobada.',
      sourceService: 'ms-bookings',
      sourceEntity: 'booking',
      sourceUuid: 'booking-uuid',
    }));
    expect(result).toEqual({ success: true, notificationId: 1 });
  });

  it('incluye el motivo en el cuerpo cuando el evento lo trae (ej. rechazo)', async () => {
    await consumer.handle('reserva_rejected', {
      recipientUuid: 'requester-uuid',
      referenceLabel: 'BK-2026-ABCD',
      comment: 'Aula en mantenimiento',
    });
    expect(notificacionService.create).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Tu reserva BK-2026-ABCD fue rechazada: Aula en mantenimiento.',
    }));
  });

  it('cubre los 4 servicios de origen documentados (booking/request/event/pqrs)', () => {
    const sourceServices = new Set(Object.values(EVENT_DEFINITIONS).map((d) => d.sourceService));
    expect(sourceServices).toEqual(new Set(['ms-bookings', 'ms-requests', 'ms-events', 'ms-pqrs']));
  });
});
