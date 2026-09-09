const request = require('supertest');

const initApp = require('../../src/app');

jest.mock('../../src/core/loaders/database.loader', () => jest.fn().mockResolvedValue(true));
jest.mock('../../src/modules/auth/auth.repository', () => jest.fn().mockImplementation(() => ({
  findByEmail: jest.fn().mockResolvedValue({
    id: 1,
    uuid: '123',
    email: 'test@test.com',
    password: '$2b$12$dummyhash',
    roles: ['user'],
  }),
  findPermissions: jest.fn().mockResolvedValue([{ module: 'auth', action: 'read' }]),
  updateRefreshToken: jest.fn().mockResolvedValue(true),
})));

describe('Auth E2E Tests', () => {
  let app;

  beforeAll(() => {
    app = initApp();
  });

  describe('POST /api/v1/auth/login', () => {
    it('debe retornar 401 con credenciales inválidas', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@test.com', password: 'wrongpassword' });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });
  });
});
