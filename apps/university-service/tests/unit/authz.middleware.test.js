const { ForbiddenError, UnauthorizedError } = require('../../src/core/exceptions');
const {
  requireAuth, requireRole, requireTrustedService,
} = require('../../src/core/middleware/authz.middleware');

describe('requireAuth', () => {
  it('llama a next con UnauthorizedError si no hay req.user', () => {
    const next = jest.fn();
    requireAuth({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('llama a next() sin error si hay req.user', () => {
    const next = jest.fn();
    requireAuth({ user: { id: 1, roles: [] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireRole', () => {
  it('llama a next con ForbiddenError si el usuario no tiene el rol', () => {
    const next = jest.fn();
    requireRole('ADMIN')({ user: { id: 1, roles: ['STUDENT'] } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('llama a next() sin error si el usuario tiene el rol', () => {
    const next = jest.fn();
    requireRole('ADMIN')({ user: { id: 1, roles: ['ADMIN'] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireTrustedService', () => {
  it('llama a next con UnauthorizedError si req.isTrustedService no está seteado', () => {
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
