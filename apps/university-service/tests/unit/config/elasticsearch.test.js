const { esClient, ensureUniversityIndex } = require('../../../src/config/elasticsearch');

describe('Configuración de Elasticsearch', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('debe crear el índice uajs_university si no existe', async () => {
    const existsSpy = jest
      .spyOn(esClient.client.indices, 'exists')
      .mockResolvedValue({ body: false });
    const createSpy = jest
      .spyOn(esClient.client.indices, 'create')
      .mockResolvedValue({ body: { acknowledged: true } });

    await ensureUniversityIndex();

    expect(existsSpy).toHaveBeenCalledWith({ index: 'uajs_university' });
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 'uajs_university',
        body: expect.objectContaining({
          settings: expect.any(Object),
          mappings: expect.any(Object),
        }),
      }),
    );
  });

  it('no debe intentar crear el índice si ya existe', async () => {
    const existsSpy = jest.spyOn(esClient.client.indices, 'exists').mockResolvedValue(true);
    const createSpy = jest.spyOn(esClient.client.indices, 'create').mockResolvedValue({});

    await ensureUniversityIndex();

    expect(existsSpy).toHaveBeenCalledWith({ index: 'uajs_university' });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('debe atrapar errores en la creación sin lanzar excepción fatal', async () => {
    jest
      .spyOn(esClient.client.indices, 'exists')
      .mockRejectedValue(new Error('ES connection error'));
    await expect(ensureUniversityIndex()).resolves.not.toThrow();
  });
});
