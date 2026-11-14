const UsuarioController = require('../../../src/modules/usuario/usuario.controller');

describe('UsuarioController', () => {
  let service;
  let controller;
  let res;
  let next;

  beforeEach(() => {
    service = {
      getMiPerfil: jest.fn().mockResolvedValue({ id: 1 }),
      upsertMiPerfil: jest.fn().mockResolvedValue({ id: 1 }),
      getMisPreferencias: jest.fn().mockResolvedValue({ userId: 42 }),
      upsertMisPreferencias: jest.fn().mockResolvedValue({ userId: 42 }),
      getPerfilPorUsuario: jest.fn().mockResolvedValue({ id: 2 }),
      listarPerfiles: jest.fn().mockResolvedValue({ data: [{ id: 2 }], meta: { total: 1 } }),
      eliminarPerfil: jest.fn().mockResolvedValue({ message: 'ok' }),
    };
    controller = new UsuarioController(service);
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('getMiPerfil responde 200 con el perfil del usuario del token', async () => {
    await controller.getMiPerfil({ userId: 42 }, res, next);

    expect(service.getMiPerfil).toHaveBeenCalledWith(42);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 1 } });
  });

  it('upsertMiPerfil pasa el cuerpo validado al servicio', async () => {
    const body = { firstName: 'Ana', lastName: 'Pérez' };

    await controller.upsertMiPerfil({ userId: 42, body }, res, next);

    expect(service.upsertMiPerfil).toHaveBeenCalledWith(42, body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getMisPreferencias responde 200 con las preferencias', async () => {
    await controller.getMisPreferencias({ userId: 42 }, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { userId: 42 } });
  });

  it('upsertMisPreferencias pasa el cuerpo al servicio', async () => {
    const body = { notifyEmail: false };

    await controller.upsertMisPreferencias({ userId: 42, body }, res, next);

    expect(service.upsertMisPreferencias).toHaveBeenCalledWith(42, body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getPerfilPorUsuario usa el userId de los parámetros', async () => {
    await controller.getPerfilPorUsuario({ params: { userId: 2 } }, res, next);

    expect(service.getPerfilPorUsuario).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 2 } });
  });

  it('listarPerfiles responde con data y meta', async () => {
    await controller.listarPerfiles({ query: { page: 1 } }, res, next);

    expect(service.listarPerfiles).toHaveBeenCalledWith({ page: 1 });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 2 }],
      meta: { total: 1 },
    });
  });

  it('eliminarPerfil responde 200 con el mensaje del servicio', async () => {
    await controller.eliminarPerfil({ params: { userId: 2 } }, res, next);

    expect(service.eliminarPerfil).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { message: 'ok' } });
  });

  it('reenvía los errores del servicio a next', async () => {
    const error = new Error('fallo');
    service.getMiPerfil.mockRejectedValue(error);

    await controller.getMiPerfil({ userId: 42 }, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
