const identityMiddleware = require('../../src/core/middleware/identity.middleware');

function mockReqRes(headers = {}) {
  return {
    req: { headers, path: '/test' },
    res: {},
    next: jest.fn(),
  };
}

describe('identityMiddleware', () => {
  it('no establece req.user ni req.isTrustedService si falta X-Service-Token', () => {
    const { req, res, next } = mockReqRes({ 'x-user-id': '5', 'x-user-roles': 'ADMIN' });

    identityMiddleware(req, res, next);

    expect(req.user).toBeUndefined();
    expect(req.isTrustedService).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('no establece nada si X-Service-Token no coincide (posible forjado)', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'token-incorrecto',
      'x-user-id': '5',
    });

    identityMiddleware(req, res, next);

    expect(req.user).toBeUndefined();
    expect(req.isTrustedService).toBeUndefined();
  });

  it('establece req.user (con uuid) y req.isTrustedService cuando el token y el usuario son válidos', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'test_service_token_min_32_characters_long',
      'x-user-id': '5',
      'x-user-uuid': 'user-uuid-5',
      'x-user-roles': 'ADMIN,STUDENT',
    });

    identityMiddleware(req, res, next);

    expect(req.isTrustedService).toBe(true);
    expect(req.user).toEqual({
      id: 5, uuid: 'user-uuid-5', nombre: null, roles: ['ADMIN', 'STUDENT'],
    });
  });

  it('decodifica X-User-Name (puede traer tildes/espacios codificados)', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'test_service_token_min_32_characters_long',
      'x-user-id': '5',
      'x-user-name': encodeURIComponent('José Pérez'),
      'x-user-roles': 'ADMIN',
    });

    identityMiddleware(req, res, next);

    expect(req.user.nombre).toBe('José Pérez');
  });
});
