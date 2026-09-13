const { esClient } = require('../../../src/config/elasticsearch');
const UniversityConsumer = require('../../../src/jobs/consumers/university.consumer');
const UniversityProducer = require('../../../src/jobs/producers/university.producer');

jest.mock('../../../src/config/queues', () => {
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    close: jest.fn().mockResolvedValue(),
  };
  let storedProcessor = null;
  const mockWorker = {
    close: jest.fn().mockResolvedValue(),
  };

  return {
    createQueue: jest.fn(() => mockQueue),
    createWorker: jest.fn((name, processor) => {
      storedProcessor = processor;
      return mockWorker;
    }),
    __getProcessor: () => storedProcessor,
    __getMockQueue: () => mockQueue,
    __getMockWorker: () => mockWorker,
  };
});

describe('Jobs BullMQ (Producer y Consumer)', () => {
  let producer;
  let consumer;
  let queuesMock;

  beforeEach(() => {
    jest.clearAllMocks();
    queuesMock = require('../../../src/config/queues');
    producer = new UniversityProducer();
    consumer = new UniversityConsumer();
  });

  describe('UniversityProducer', () => {
    it('debe encolar un evento en addUniversityEvent', async () => {
      const mockQueue = queuesMock.__getMockQueue();
      await producer.addUniversityEvent('ESTUDIANTE_MATRICULADO', { estudianteId: 1 });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'log_university_event',
        expect.objectContaining({
          eventType: 'ESTUDIANTE_MATRICULADO',
          estudianteId: 1,
          timestamp: expect.any(String),
        }),
        expect.any(Object),
      );
    });

    it('debe encolar sincronización de entidad en publishEntitySync', async () => {
      const mockQueue = queuesMock.__getMockQueue();
      await producer.publishEntitySync('empresa', 'create', { id: 1, nombre: 'Empresa Test' });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'sync_university_entity',
        expect.objectContaining({
          entityType: 'empresa',
          action: 'create',
          data: { id: 1, nombre: 'Empresa Test' },
        }),
        expect.any(Object),
      );
    });

    it('debe cerrar la cola en close()', async () => {
      const mockQueue = queuesMock.__getMockQueue();
      await producer.close();
      expect(mockQueue.close).toHaveBeenCalled();
    });
  });

  describe('UniversityConsumer', () => {
    it('debe procesar log_university_event e indexar en ES', async () => {
      const esIndexSpy = jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });
      const processor = queuesMock.__getProcessor();

      const job = {
        id: '123',
        name: 'log_university_event',
        data: { eventType: 'TEST_EVENT', user: 'admin' },
      };

      const result = await processor(job);
      expect(result).toEqual({ success: true });
      expect(esIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'test_uajs_university_events',
          body: expect.objectContaining({
            eventType: 'TEST_EVENT',
            service: 'university-service',
          }),
        }),
      );
    });

    it('debe procesar sync_university_entity action index', async () => {
      const esIndexSpy = jest.spyOn(esClient.client, 'index').mockResolvedValue({ body: {} });
      const processor = queuesMock.__getProcessor();

      const job = {
        id: '124',
        name: 'sync_university_entity',
        data: {
          entityType: 'facultad',
          action: 'index',
          data: { id: 1, nombre: 'Facultad' },
        },
      };

      const result = await processor(job);
      expect(result).toEqual({ success: true });
      expect(esIndexSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'uajs_university',
          id: 'facultad_1',
          body: expect.objectContaining({ type: 'facultad', id: 1 }),
        }),
      );
    });

    it('debe procesar sync_university_entity action delete', async () => {
      const esDeleteSpy = jest.spyOn(esClient.client, 'delete').mockResolvedValue({ body: {} });
      const processor = queuesMock.__getProcessor();

      const job = {
        id: '125',
        name: 'sync_university_entity',
        data: {
          entityType: 'facultad',
          action: 'delete',
          data: { id: 1 },
        },
      };

      const result = await processor(job);
      expect(result).toEqual({ success: true });
      expect(esDeleteSpy).toHaveBeenCalledWith({
        index: 'uajs_university',
        id: 'facultad_1',
      });
    });

    it('debe cerrar el worker en close()', async () => {
      const mockWorker = queuesMock.__getMockWorker();
      await consumer.close();
      expect(mockWorker.close).toHaveBeenCalled();
    });
  });
});
