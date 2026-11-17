const { UnauthorizedError } = require('../../src/core/exceptions');
const {
  requireAuth, requireTrustedService, requireAuthOrTrustedService,
} = require('../../src/core/middleware/authz.middleware');

describe('requireAuth', () => {
  it('llama a next con UnauthorizedError si no hay req.user', () => {
    const next = jest.fn();
    requireAuth({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});

describe('requireTrustedService', () => {
  it('llama a next con UnauthorizedError si no hay req.isTrustedService', () => {
    const next = jest.fn();
    requireTrustedService({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('llama a next() sin error si req.isTrustedService es true', () => {
    const next = jest.fn();
    requireTrustedService({ isTrustedService: true }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireAuthOrTrustedService', () => {
  it('llama a next con UnauthorizedError si no hay req.user ni req.isTrustedService', () => {
    const next = jest.fn();
    requireAuthOrTrustedService({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('llama a next() si hay req.user (usuario final autenticado)', () => {
    const next = jest.fn();
    requireAuthOrTrustedService({ user: { id: 1, roles: ['STUDENT'] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('llama a next() si req.isTrustedService es true, aunque no haya req.user (otro microservicio)', () => {
    const next = jest.fn();
    requireAuthOrTrustedService({ isTrustedService: true }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
