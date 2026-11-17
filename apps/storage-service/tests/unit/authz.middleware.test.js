const { UnauthorizedError } = require('../../src/core/exceptions');
const { requireAuth } = require('../../src/core/middleware/authz.middleware');

describe('requireAuth', () => {
  it('llama a next con UnauthorizedError si no hay req.user', () => {
    const next = jest.fn();
    requireAuth({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('llama a next() sin error si hay req.user', () => {
    const next = jest.fn();
    requireAuth({ user: { id: 1, uuid: 'u1', roles: [] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
