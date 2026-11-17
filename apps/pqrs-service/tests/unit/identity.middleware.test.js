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
    const { req, res, next } = mockReqRes({ 'x-user-id': '5' });
    identityMiddleware(req, res, next);
    expect(req.user).toBeUndefined();
  });

  it('no establece req.user si el X-Service-Token es inválido', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'token-invalido',
      'x-user-id': '5',
    });
    identityMiddleware(req, res, next);
    expect(req.user).toBeUndefined();
    expect(req.isTrustedService).toBeUndefined();
  });

  it('establece req.user con uuid y nombre decodificado cuando todo es válido', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'test_service_token_min_32_characters_long',
      'x-user-id': '5',
      'x-user-uuid': 'user-uuid-5',
      'x-user-name': encodeURIComponent('José Pérez'),
      'x-user-roles': 'STAFF',
    });
    identityMiddleware(req, res, next);
    expect(req.isTrustedService).toBe(true);
    expect(req.user).toEqual({
      id: 5, uuid: 'user-uuid-5', nombre: 'José Pérez', roles: ['STAFF'],
    });
  });

  it('marca isTrustedService aunque no venga X-User-Id', () => {
    const { req, res, next } = mockReqRes({
      'x-service-token': 'test_service_token_min_32_characters_long',
    });
    identityMiddleware(req, res, next);
    expect(req.isTrustedService).toBe(true);
    expect(req.user).toBeUndefined();
  });
});
