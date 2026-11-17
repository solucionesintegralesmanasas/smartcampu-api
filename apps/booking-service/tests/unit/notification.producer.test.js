const mockQueue = { add: jest.fn() };
jest.mock('../../src/config/queues', () => ({
  createQueue: jest.fn(() => mockQueue),
}));

const NotificationProducer = require('../../src/jobs/producers/notification.producer');

describe('NotificationProducer', () => {
  let producer;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    producer = new NotificationProducer();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resuelve normalmente cuando Redis responde rápido', async () => {
    mockQueue.add.mockResolvedValue({ id: 'job-1' });
    await expect(producer.notify('reserva_approved', { recipientUuid: 'u1' })).resolves.toBeUndefined();
  });

  it('no cuelga la petición si Redis nunca responde (reintentos infinitos de BullMQ)', async () => {
    // Simula el hang real: BullMQ/ioredis reintentando la conexión sin fin,
    // la promesa de queue.add() nunca se resuelve ni se rechaza.
    mockQueue.add.mockReturnValue(new Promise(() => {}));

    const notifyPromise = producer.notify('reserva_approved', { recipientUuid: 'u1' });
    let settled = false;
    notifyPromise.then(() => { settled = true; });

    await Promise.resolve();
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(2000);
    expect(settled).toBe(true);
  });
});
