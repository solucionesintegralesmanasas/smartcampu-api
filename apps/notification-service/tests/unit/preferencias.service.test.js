const PreferenciasService = require('../../src/modules/preferencias/preferencias.service');
const {
  CANALES_ENTREGA,
  CATEGORIAS,
} = require('../../src/core/constants/notification.constants');

const crear = (overrides = {}) => {
  const repository = {
    findByUser: jest.fn().mockResolvedValue([]),
    upsertMany: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { service: new PreferenciasService(repository), repository };
};

const usuario = { id: 5 };

describe('PreferenciasService.obtener', () => {
  it('devuelve la matriz completa con canales activos por defecto', async () => {
    const { service } = crear();

    const data = await service.obtener(usuario);

    expect(data).toHaveLength(CATEGORIAS.length * CANALES_ENTREGA.length);
    expect(data.every((p) => p.habilitado)).toBe(true);
  });

  it('respeta los valores guardados', async () => {
    const { service } = crear({
      findByUser: jest.fn().mockResolvedValue([
        { categoria: 'request', canal: 'email', habilitado: false },
      ]),
    });

    const data = await service.obtener(usuario);
    const item = data.find((p) => p.categoria === 'request' && p.canal === 'email');
    expect(item.habilitado).toBe(false);
  });
});

describe('PreferenciasService.actualizar', () => {
  it('hace upsert con el identificador del usuario y devuelve la matriz', async () => {
    const { service, repository } = crear();

    await service.actualizar(usuario, [
      { categoria: 'request', canal: 'email', habilitado: false },
    ]);

    expect(repository.upsertMany).toHaveBeenCalledWith('5', [
      { categoria: 'request', canal: 'email', habilitado: false },
    ]);
  });
});
