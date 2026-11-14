const CatalogosService = require('../../src/modules/catalogos/catalogos.service');

const crearCache = () => {
  const store = new Map();
  return {
    get: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
    set: jest.fn((key, value) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn((key) => {
      store.delete(key);
      return Promise.resolve(1);
    }),
  };
};

describe('CatalogosService', () => {
  it('consulta el repositorio y cachea el resultado', async () => {
    const repository = { findEstados: jest.fn().mockResolvedValue([{ codigo: 'pending' }]) };
    const cache = crearCache();
    const service = new CatalogosService(repository, cache, 60);

    const primera = await service.listarEstados();
    const segunda = await service.listarEstados();

    expect(primera).toEqual([{ codigo: 'pending' }]);
    expect(segunda).toEqual([{ codigo: 'pending' }]);
    expect(repository.findEstados).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalled();
  });

  it('funciona sin caché (cache nulo)', async () => {
    const repository = { findTipos: jest.fn().mockResolvedValue([{ codigo: 'CERT' }]) };
    const service = new CatalogosService(repository, null);

    const result = await service.listarTipos();
    expect(result).toEqual([{ codigo: 'CERT' }]);
  });

  it('tolera fallos del caché al leer', async () => {
    const repository = { findEstados: jest.fn().mockResolvedValue([{ codigo: 'x' }]) };
    const cache = { get: jest.fn().mockRejectedValue(new Error('redis down')), set: jest.fn() };
    const service = new CatalogosService(repository, cache, 60);

    await expect(service.listarEstados()).resolves.toEqual([{ codigo: 'x' }]);
  });
});
