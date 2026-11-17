const NotificationDispatcher = require('../../src/core/services/notification-dispatcher.service');
const { CANALES, ESTADOS } = require('../../src/core/constants/notification.constants');

const crearDeps = (overrides = {}) => {
  const notificationsRepository = {
    create: jest.fn((data) => Promise.resolve({ id: 1, uuid: 'n-uuid', ...data })),
    findByUuid: jest.fn().mockResolvedValue({
      id: 1,
      uuid: 'n-uuid',
      channel: CANALES.EMAIL,
      status: ESTADOS.QUEUED,
      recipientUuid: '5',
      recipientEmail: 'ana@uajs.edu.co',
      subject: 'Asunto',
      body: 'Cuerpo',
    }),
    updateStatus: jest.fn().mockResolvedValue(1),
    ...overrides.notificationsRepository,
  };
  const templatesRepository = {
    findOne: jest.fn().mockResolvedValue(null),
    ...overrides.templatesRepository,
  };
  const preferencesRepository = {
    isEnabled: jest.fn().mockResolvedValue(true),
    ...overrides.preferencesRepository,
  };
  const pushRepository = {
    findActiveByUser: jest.fn().mockResolvedValue([]),
    ...overrides.pushRepository,
  };
  const deliveryProducer = { addDelivery: jest.fn().mockResolvedValue(undefined) };
  const generatedProducer = { publish: jest.fn().mockResolvedValue({}) };
  const channelAdapters = {
    email: { send: jest.fn().mockResolvedValue({ proveedorId: 'log-1' }) },
    push: { send: jest.fn().mockResolvedValue({ proveedorId: 'log-2' }) },
  };

  const dispatcher = new NotificationDispatcher({
    notificationsRepository,
    templatesRepository,
    preferencesRepository,
    pushRepository,
    deliveryProducer,
    generatedProducer,
    channelAdapters,
  });

  return {
    dispatcher,
    notificationsRepository,
    templatesRepository,
    preferencesRepository,
    pushRepository,
    deliveryProducer,
    generatedProducer,
    channelAdapters,
  };
};

describe('NotificationDispatcher.notifyUser', () => {
  it('crea la notificación in-app y encola correo y push', async () => {
    const deps = crearDeps();

    const resultado = await deps.dispatcher.notifyUser({
      recipientId: 5,
      templateCode: 'request.created',
      variables: { numero_solicitud: 'REQ-1', tipo_tramite: 'Certificado', descripcion: '' },
    });

    expect(resultado).not.toBeNull();
    // in_app + email + push
    expect(deps.notificationsRepository.create).toHaveBeenCalledTimes(3);
    expect(deps.deliveryProducer.addDelivery).toHaveBeenCalledTimes(2);
    expect(deps.generatedProducer.publish).toHaveBeenCalled();
  });

  it('guarda la entrega como fallida si el canal está desactivado', async () => {
    const deps = crearDeps({
      preferencesRepository: { isEnabled: jest.fn().mockResolvedValue(false) },
    });

    await deps.dispatcher.notifyUser({
      recipientId: 5,
      templateCode: 'request.created',
      variables: {},
    });

    expect(deps.deliveryProducer.addDelivery).not.toHaveBeenCalled();
    const estados = deps.notificationsRepository.create.mock.calls.map(([d]) => d.status);
    expect(estados).toContain(ESTADOS.FAILED);
  });

  it('no genera notificación si la plantilla está inactiva en BD', async () => {
    const deps = crearDeps({
      templatesRepository: {
        findOne: jest.fn().mockResolvedValue({ isActive: false }),
      },
    });

    const resultado = await deps.dispatcher.notifyUser({
      recipientId: 5,
      templateCode: 'request.created',
    });

    expect(resultado).toBeNull();
    expect(deps.notificationsRepository.create).not.toHaveBeenCalled();
  });
});

describe('NotificationDispatcher.deliver', () => {
  it('entrega por correo y marca como delivered', async () => {
    const deps = crearDeps();

    const resultado = await deps.dispatcher.deliver('n-uuid');

    expect(deps.channelAdapters.email.send).toHaveBeenCalled();
    expect(deps.notificationsRepository.updateStatus).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: ESTADOS.DELIVERED }),
    );
    expect(resultado.entregada).toBe(true);
  });

  it('marca fallida una entrega de correo sin destinatario', async () => {
    const deps = crearDeps({
      notificationsRepository: {
        findByUuid: jest.fn().mockResolvedValue({
          id: 1,
          uuid: 'n-uuid',
          channel: CANALES.EMAIL,
          status: ESTADOS.QUEUED,
          recipientUuid: '5',
          recipientEmail: null,
        }),
      },
    });

    const resultado = await deps.dispatcher.deliver('n-uuid');

    expect(resultado.omitida).toBe('sin_correo');
    expect(deps.channelAdapters.email.send).not.toHaveBeenCalled();
  });

  it('omite la entrega si ya fue entregada', async () => {
    const deps = crearDeps({
      notificationsRepository: {
        findByUuid: jest.fn().mockResolvedValue({ id: 1, channel: CANALES.EMAIL, status: ESTADOS.DELIVERED }),
      },
    });

    const resultado = await deps.dispatcher.deliver('n-uuid');
    expect(resultado.omitida).toBe('ya_entregada');
  });
});

describe('NotificationDispatcher.notifyBroadcast', () => {
  it('crea una difusión sin encolar canales', async () => {
    const deps = crearDeps();

    const resultado = await deps.dispatcher.notifyBroadcast({
      templateCode: 'event.scheduled',
      variables: { nombre: 'Feria', fecha: '2026-05-01', hora: '10:00', sede: 'Central' },
    });

    expect(resultado).not.toBeNull();
    expect(deps.notificationsRepository.create).toHaveBeenCalledTimes(1);
    expect(deps.deliveryProducer.addDelivery).not.toHaveBeenCalled();
  });
});
