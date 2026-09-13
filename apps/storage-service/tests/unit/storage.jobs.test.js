jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    STORAGE_QUEUE: 'test_storage_jobs',
    STORAGE_INDEX: 'test_uajs_storage',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
  },
}));

jest.mock('../../src/config/queues', () => ({
  createQueue: jest.fn(),
  createWorker: jest.fn(),
}));

jest.mock('../../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    bulk: jest.fn(),
    client: { indices: { exists: jest.fn(), create: jest.fn() } },
  },
  ensureStorageIndex: jest.fn(),
}));

const { esClient } = require('../../src/config/elasticsearch');
const { createQueue, createWorker } = require('../../src/config/queues');
const StorageConsumer = require('../../src/jobs/consumers/storage.consumer');
const StorageProducer = require('../../src/jobs/producers/storage.producer');

describe('StorageProducer', () => {
  let addMock;

  beforeEach(() => {
    jest.clearAllMocks();
    addMock = jest.fn().mockResolvedValue(undefined);
    createQueue.mockReturnValue({ add: addMock });
  });

  it('crea la cola con STORAGE_QUEUE', () => {
    // eslint-disable-next-line no-new
    new StorageProducer();
    expect(createQueue).toHaveBeenCalledWith('test_storage_jobs');
  });

  it('encola index_file con reintentos', async () => {
    const producer = new StorageProducer();
    await producer.indexFile({ uuid: 'u1' });

    expect(addMock).toHaveBeenCalledWith(
      'index_file',
      expect.objectContaining({ uuid: 'u1', timestamp: expect.any(String) }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('encola update_file', async () => {
    const producer = new StorageProducer();
    await producer.updateFileInES({ uuid: 'u1', carpeta: 'x' });

    expect(addMock).toHaveBeenCalledWith(
      'update_file',
      expect.objectContaining({ uuid: 'u1' }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('encola delete_file con UUID', async () => {
    const producer = new StorageProducer();
    await producer.deleteFileFromES('uuid-123');

    expect(addMock).toHaveBeenCalledWith(
      'delete_file',
      expect.objectContaining({ uuid: 'uuid-123' }),
      expect.objectContaining({ attempts: 3 }),
    );
  });

  it('encola bulk_process con archivos', async () => {
    const producer = new StorageProducer();
    await producer.bulkProcessFiles([{ uuid: 'a' }, { uuid: 'b' }]);

    expect(addMock).toHaveBeenCalledWith(
      'bulk_process',
      expect.objectContaining({ files: expect.arrayContaining([expect.objectContaining({ uuid: 'a' })]) }),
      expect.objectContaining({ attempts: 3 }),
    );
  });
});

describe('StorageConsumer', () => {
  let processor;
  let consumer;

  const fileData = {
    id: 1,
    uuid: '550e8400-e29b-41d4-a716-446655440000',
    nombre_original: 'doc.pdf',
    nombre_sistema: 'uuid.pdf',
    ruta_acceso: '/uploads/uuid.pdf',
    mime_type: 'application/pdf',
    peso_bytes: 100,
    entidad_asociada: 'evento',
    uuid_asociado: null,
    subido_por: 5,
    subido_por_nombre: 'Test',
    extension: '.pdf',
    carpeta: 'general',
    publico: false,
    activo: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createWorker.mockImplementation((name, fn) => {
      processor = fn;
      return { close: jest.fn() };
    });
    esClient.index.mockResolvedValue({});
    esClient.update.mockResolvedValue({});
    esClient.delete.mockResolvedValue({});
    esClient.bulk.mockResolvedValue({});
    consumer = new StorageConsumer();
  });

  it('indexa archivo en ES (job index_file)', async () => {
    const result = await processor({ name: 'index_file', data: fileData });

    expect(esClient.index).toHaveBeenCalledWith(
      expect.objectContaining({ index: 'test_uajs_storage', id: fileData.uuid }),
    );
    expect(result).toEqual({ success: true });
  });

  it('actualiza documento en ES (job update_file)', async () => {
    await processor({ name: 'update_file', data: { uuid: fileData.uuid, carpeta: 'nueva' } });

    expect(esClient.update).toHaveBeenCalledWith(
      expect.objectContaining({ index: 'test_uajs_storage', id: fileData.uuid }),
    );
  });

  it('elimina documento de ES (job delete_file)', async () => {
    await processor({ name: 'delete_file', data: { uuid: fileData.uuid } });

    expect(esClient.delete).toHaveBeenCalledWith(
      expect.objectContaining({ index: 'test_uajs_storage', id: fileData.uuid }),
    );
  });

  it('procesa lote con bulk (job bulk_process)', async () => {
    await processor({ name: 'bulk_process', data: { files: [fileData, fileData] } });

    expect(esClient.bulk).toHaveBeenCalledWith(expect.objectContaining({ body: expect.any(Array) }));
    expect(esClient.bulk.mock.calls[0][0].body).toHaveLength(4);
  });

  it('ignora lote vacío', async () => {
    await processor({ name: 'bulk_process', data: { files: [] } });
    expect(esClient.bulk).not.toHaveBeenCalled();
  });

  it('advierte ante job desconocido', async () => {
    const result = await processor({ name: 'desconocido', data: {} });
    expect(result).toEqual({ success: true });
    expect(esClient.index).not.toHaveBeenCalled();
  });

  it('relanza error si falla el procesamiento', async () => {
    esClient.index.mockRejectedValue(new Error('ES caído'));
    await expect(processor({ name: 'index_file', data: fileData })).rejects.toThrow('ES caído');
  });

  it('cierra el worker', async () => {
    const closeMock = jest.fn();
    createWorker.mockReturnValue({ close: closeMock });
    const c = new StorageConsumer();
    await c.close();
    expect(closeMock).toHaveBeenCalled();
    expect(consumer).toBeDefined();
  });

  it('handleBulkProcess retorna sin archivos', async () => {
    await expect(consumer.handleBulkProcess({})).resolves.toBeUndefined();
  });
});
