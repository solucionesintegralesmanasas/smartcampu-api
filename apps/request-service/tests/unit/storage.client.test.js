const { getFile } = require('../../src/clients/storage.client');

const REQUESTER = { id: 1, uuid: 'requester-uuid', roles: ['STUDENT'] };

describe('storage.client getFile', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('retorna el archivo si storage-service responde ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 5, uuid: 'file-uuid', originalName: 'x.pdf' } }),
    });
    const result = await getFile(5, REQUESTER);
    expect(result).toEqual({ id: 5, uuid: 'file-uuid', originalName: 'x.pdf' });
  });

  it('reenvía la identidad del requester, no solo el token de servicio', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    await getFile(5, REQUESTER);
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['X-User-Id']).toBe('1');
    expect(options.headers['X-User-Uuid']).toBe('requester-uuid');
  });

  it('retorna null si storage-service responde con error (ej. no es el dueño)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const result = await getFile(5, REQUESTER);
    expect(result).toBeNull();
  });

  it('retorna null si la llamada falla', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await getFile(5, REQUESTER);
    expect(result).toBeNull();
  });
});
