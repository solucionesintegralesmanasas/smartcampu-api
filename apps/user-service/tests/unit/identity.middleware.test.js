const identityMiddleware = require('../../src/core/middleware/identity.middleware');

function mockReqRes(headers = {}) {
  return {
    req: { headers, path: '/test' },
    res: {},
    next: jest.fn(),
  };
}

describe('identityMiddleware', () => {
  it('no establece req.user si falta X-Service-Token', () => {
    const { req, res, next } = mockReqRes({ 'x-user-id': '5', 'x-user-roles': 'ADMIN' });

    identityMiddleware(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('no establece req.user si X-Service-Token no coincide (posible forjado)', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'token-incorrecto',
      'x-user-id': '5',
      'x-user-roles': 'ADMIN',
    });

    identityMiddleware(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('establece req.user (con uuid) cuando el X-Service-Token es válido', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'test_service_token_min_32_characters_long',
      'x-user-id': '5',
      'x-user-uuid': 'user-uuid-5',
      'x-user-roles': 'ADMIN,STUDENT',
    });

    identityMiddleware(req, res, next);

    expect(req.user).toEqual({
      id: 5, uuid: 'user-uuid-5', nombre: null, roles: ['ADMIN', 'STUDENT'],
    });
    expect(next).toHaveBeenCalled();
  });

  it('decodifica X-User-Name (puede traer tildes/espacios codificados)', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'test_service_token_min_32_characters_long',
      'x-user-id': '5',
      'x-user-uuid': 'user-uuid-5',
      'x-user-name': encodeURIComponent('José Pérez'),
      'x-user-roles': 'ADMIN',
    });

    identityMiddleware(req, res, next);

    expect(req.user.nombre).toBe('José Pérez');
  });

  it('no establece req.user si el token es válido pero no viene X-User-Id (tráfico anónimo del gateway)', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'test_service_token_min_32_characters_long',
    });

    identityMiddleware(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
