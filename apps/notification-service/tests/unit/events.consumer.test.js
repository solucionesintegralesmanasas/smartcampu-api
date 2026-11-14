// eslint-disable-next-line import/no-extraneous-dependencies
const { EVENT_TYPES } = require('@uajs/shared-types');

const EventsConsumer = require('../../src/jobs/consumers/events.consumer');

const crearConsumer = (overrides = {}) => {
  const dispatcher = {
    notifyUser: jest.fn().mockResolvedValue({}),
    notifyBroadcast: jest.fn().mockResolvedValue({}),
    ...overrides.dispatcher,
  };
  const idempotency = {
    claim: jest.fn().mockResolvedValue(true),
    complete: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    ...overrides.idempotency,
  };
  return { consumer: new EventsConsumer(dispatcher, idempotency), dispatcher, idempotency };
};

describe('EventsConsumer.procesar', () => {
  it('notifica al usuario ante ReservaConfirmadaEvent', async () => {
    const { consumer, dispatcher, idempotency } = crearConsumer();

    const resultado = await consumer.procesar({
      eventId: 'e1',
      eventType: EVENT_TYPES.RESERVA_CONFIRMADA,
      payload: {
        reservaUuid: 'r-1',
        recursoId: 3,
        usuarioId: 5,
        fechaReserva: '2026-05-01',
        horaInicio: '08:00',
        horaFin: '10:00',
      },
    });

    expect(dispatcher.notifyUser).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: 5, templateCode: 'booking.confirmed' }),
    );
    expect(idempotency.complete).toHaveBeenCalledWith('e1');
    expect(resultado.procesado).toBe(true);
  });

  it('crea difusión ante EventoProgramadoEvent', async () => {
    const { consumer, dispatcher } = crearConsumer();

    await consumer.procesar({
      eventId: 'e2',
      eventType: EVENT_TYPES.EVENTO_PROGRAMADO,
      payload: { eventoUuid: 'ev-1', nombre: 'Feria' },
    });

    expect(dispatcher.notifyBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ templateCode: 'event.scheduled' }),
    );
  });

  it('omite eventos duplicados por eventId', async () => {
    const { consumer, dispatcher, idempotency } = crearConsumer({
      idempotency: { claim: jest.fn().mockResolvedValue(false) },
    });

    const resultado = await consumer.procesar({
      eventId: 'e1',
      eventType: EVENT_TYPES.RESERVA_CONFIRMADA,
      payload: { usuarioId: 5 },
    });

    expect(resultado.omitido).toBe('duplicado');
    expect(dispatcher.notifyUser).not.toHaveBeenCalled();
    expect(idempotency.complete).not.toHaveBeenCalled();
  });

  it('omite la notificación de PQRS sin destinatario y no falla', async () => {
    const { consumer, dispatcher, idempotency } = crearConsumer();

    const resultado = await consumer.procesar({
      eventId: 'e3',
      eventType: EVENT_TYPES.PQRS_RESPONDIDA,
      payload: { pqrsUuid: 'p-1', tipoPqrs: 'QUEJA', respuesta: 'Atendida', usuarioRespondeId: 9 },
    });

    expect(dispatcher.notifyUser).not.toHaveBeenCalled();
    expect(idempotency.complete).toHaveBeenCalledWith('e3');
    expect(resultado.procesado).toBe(true);
  });

  it('libera el reclamo si el manejador falla', async () => {
    const { consumer, idempotency } = crearConsumer({
      dispatcher: { notifyUser: jest.fn().mockRejectedValue(new Error('boom')) },
    });

    await expect(
      consumer.procesar({
        eventId: 'e4',
        eventType: EVENT_TYPES.SOLICITUD_CREADA,
        payload: { usuarioId: 5 },
      }),
    ).rejects.toThrow('boom');

    expect(idempotency.release).toHaveBeenCalledWith('e4');
  });

  it('omite eventos sin manejador registrado', async () => {
    const { consumer } = crearConsumer();
    const resultado = await consumer.procesar({ eventId: 'e5', eventType: 'EventoDesconocido' });
    expect(resultado.omitido).toBe('sin_manejador');
  });
});
