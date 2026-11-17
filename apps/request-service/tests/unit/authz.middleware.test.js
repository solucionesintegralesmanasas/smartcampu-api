const { ForbiddenError, UnauthorizedError } = require('../../src/core/exceptions');
const { requireAuth, requireRole } = require('../../src/core/middleware/authz.middleware');

describe('requireAuth', () => {
  it('llama a next con UnauthorizedError si no hay req.user', () => {
    const next = jest.fn();
    requireAuth({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});

describe('requireRole', () => {
  it('llama a next con ForbiddenError si el usuario no tiene el rol', () => {
    const next = jest.fn();
    requireRole('STAFF')({ user: { roles: ['STUDENT'] } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('llama a next() sin error si el usuario tiene el rol', () => {
    const next = jest.fn();
    requireRole('STAFF')({ user: { roles: ['STAFF'] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
