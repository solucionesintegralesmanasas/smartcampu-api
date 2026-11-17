const { ForbiddenError, UnauthorizedError } = require('../../src/core/exceptions');
const { requireAuth, requireRole } = require('../../src/core/middleware/authz.middleware');

describe('requireAuth', () => {
  it('llama a next con UnauthorizedError si no hay req.user', () => {
    const req = {};
    const next = jest.fn();

    requireAuth(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('llama a next() sin error si hay req.user', () => {
    const req = { user: { id: 1, roles: ['STUDENT'] } };
    const next = jest.fn();

    requireAuth(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('requireRole', () => {
  it('llama a next con ForbiddenError si el usuario no tiene el rol', () => {
    const req = { user: { id: 1, roles: ['STUDENT'] } };
    const next = jest.fn();

    requireRole('ADMIN', 'SUPERADMIN')(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('llama a next con UnauthorizedError si no hay req.user', () => {
    const req = {};
    const next = jest.fn();

    requireRole('ADMIN')(req, {}, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('llama a next() sin error si el usuario tiene uno de los roles permitidos', () => {
    const req = { user: { id: 1, roles: ['ADMIN'] } };
    const next = jest.fn();

    requireRole('ADMIN', 'SUPERADMIN')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});
