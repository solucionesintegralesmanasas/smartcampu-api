const { getMysqlPool } = require('../../../src/config/database/mysql');
const { esClient } = require('../../../src/config/elasticsearch');
const { createQueue, createWorker } = require('../../../src/config/queues');
const databaseLoader = require('../../../src/core/loaders/database.loader');

describe('Database Loader & DB Config', () => {
  it('databaseLoader debe inicializar ES y ping MySQL', async () => {
    jest.spyOn(esClient.client.indices, 'exists').mockResolvedValue({ body: true });
    await expect(databaseLoader()).resolves.not.toThrow();
  });

  it('databaseLoader no debe lanzar si ES o MySQL fallan', async () => {
    jest.spyOn(esClient.client.indices, 'exists').mockRejectedValue(new Error('ES Down'));
    const pool = getMysqlPool();
    jest.spyOn(pool, 'ping').mockRejectedValue(new Error('MySQL Down'));

    await expect(databaseLoader()).resolves.not.toThrow();
  });

  it('getMysqlPool debe retornar la misma instancia singleton', () => {
    const pool1 = getMysqlPool();
    const pool2 = getMysqlPool();
    expect(pool1).toBe(pool2);
  });

  it('createQueue y createWorker deben instanciar objetos BullMQ', () => {
    const queue = createQueue('test_queue');
    expect(queue).toBeDefined();

    const worker = createWorker('test_queue', async () => {});
    expect(worker).toBeDefined();
  });
});
