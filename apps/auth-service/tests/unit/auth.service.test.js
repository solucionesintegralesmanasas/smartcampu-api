jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-access-token'),
  verify: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

jest.mock('../../src/config/elasticsearch', () => ({
  esClient: { index: jest.fn().mockResolvedValue({}) },
}));

jest.mock('../../src/config/env', () => ({
  env: {
    JWT_SECRET: 'a'.repeat(64),
    JWT_REFRESH_SECRET: 'b'.repeat(64),
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_ROUNDS: 12,
    AUTH_EVENTS_INDEX: 'uajs_auth_events',
  },
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { esClient } = require('../../src/config/elasticsearch');
const { UnauthorizedError, ConflictError } = require('../../src/core/exceptions');
const AuthService = require('../../src/modules/auth/auth.service');

function mockRepository(overrides = {}) {
  return {
    findByEmail: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue({
      id: 1,
      uuid: 'u1',
      email: 'test@test.com',
      roles: ['user'],
    }),
    create: jest.fn().mockResolvedValue({
      id: 1,
      uuid: 'u1',
      email: 'test@test.com',
      roles: ['user'],
    }),
    updateRefreshToken: jest.fn().mockResolvedValue(undefined),
    findByRefreshToken: jest.fn().mockResolvedValue(null),
    findPermissions: jest.fn().mockResolvedValue([{ module: 'auth', action: 'read' }]),
    invalidateRefreshTokens: jest.fn().mockResolvedValue(undefined),
    createPasswordResetToken: jest.fn().mockResolvedValue(undefined),
    findPasswordResetToken: jest.fn().mockResolvedValue(null),
    deletePasswordResetToken: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    findFullProfile: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function mockEmailProducer() {
  return { addJob: jest.fn().mockResolvedValue(undefined) };
}

function mockReq(overrides = {}) {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    ...overrides,
  };
}

describe('AuthService', () => {
  let service;
  let repo;
  let emailProducer;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = mockRepository();
    emailProducer = mockEmailProducer();
    service = new AuthService(repo, emailProducer);
  });

  describe('register', () => {
    it('debe registrar un usuario exitosamente', async () => {
      const result = await service.register({
        email: 'new@test.com',
        password: 'password123',
        nombres: 'John',
        apellidos: 'Doe',
        tipoDocumentoId: 1,
        numeroDocumento: '12345',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('uuid');
      expect(result.email).toBe('test@test.com');
      expect(repo.create).toHaveBeenCalled();
      expect(esClient.index).toHaveBeenCalled();
    });

    it('debe lanzar ConflictError si el email ya existe', async () => {
      repo.findByEmail.mockResolvedValue({ id: 1, email: 'existing@test.com' });

      await expect(
        service.register({
          email: 'existing@test.com',
          password: 'password123',
          nombres: 'John',
          apellidos: 'Doe',
          tipoDocumentoId: 1,
          numeroDocumento: '12345',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    it('debe retornar tokens con credenciales válidas', async () => {
      repo.findByEmail.mockResolvedValue({
        id: 1,
        uuid: 'u1',
        email: 'test@test.com',
        password: '$2b$12$hashedpassword',
        roles: ['user'],
      });
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.login(
        { email: 'test@test.com', password: 'correct' },
        mockReq(),
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe(1);
      expect(repo.updateRefreshToken).toHaveBeenCalled();
      expect(esClient.index).toHaveBeenCalled();
    });

    it('debe lanzar UnauthorizedError si el usuario no existe', async () => {
      repo.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'noexist@test.com', password: 'pass' }, mockReq()),
      ).rejects.toThrow(UnauthorizedError);

      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            eventType: 'login_failed',
            status: 'user_not_found',
          }),
        }),
      );
    });

    it('debe lanzar UnauthorizedError si la contraseña es incorrecta', async () => {
      repo.findByEmail.mockResolvedValue({
        id: 1,
        uuid: 'u1',
        email: 'test@test.com',
        password: '$2b$12$hashedpassword',
        roles: ['user'],
      });
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }, mockReq()),
      ).rejects.toThrow(UnauthorizedError);

      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            eventType: 'login_failed',
            status: 'invalid_password',
          }),
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('debe retornar un nuevo accessToken con refresh token válido', async () => {
      repo.findByRefreshToken.mockResolvedValue({
        id: 1,
        uuid: 'u1',
        email: 'test@test.com',
        roles: ['user'],
      });
      jwt.verify.mockReturnValue({ sub: 1 });

      const result = await service.refreshToken({ refreshToken: 'valid-token' });

      expect(result).toHaveProperty('accessToken');
      expect(result.expiresIn).toBe('15m');
      expect(esClient.index).toHaveBeenCalled();
    });

    it('debe lanzar UnauthorizedError si el refresh token es inválido', async () => {
      repo.findByRefreshToken.mockResolvedValue(null);

      await expect(service.refreshToken({ refreshToken: 'invalid' })).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it('debe lanzar UnauthorizedError si el refresh token está expirado', async () => {
      repo.findByRefreshToken.mockResolvedValue({
        id: 1,
        uuid: 'u1',
        email: 'test@test.com',
        roles: ['user'],
      });
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshToken({ refreshToken: 'expired' })).rejects.toThrow(
        UnauthorizedError,
      );
    });
  });

  describe('logout', () => {
    it('debe cerrar sesión invalidando el refresh token', async () => {
      repo.findByRefreshToken.mockResolvedValue({
        id: 1,
        uuid: 'u1',
        email: 'test@test.com',
      });

      const result = await service.logout({ refreshToken: 'valid-token' }, mockReq());

      expect(result.message).toBeDefined();
      expect(repo.invalidateRefreshTokens).toHaveBeenCalledWith(1);
      expect(esClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({ eventType: 'user_logged_out', status: 'success' }),
        }),
      );
    });

    it('debe lanzar UnauthorizedError si el refresh token es inválido', async () => {
      repo.findByRefreshToken.mockResolvedValue(null);

      await expect(service.logout({ refreshToken: 'invalid' }, mockReq())).rejects.toThrow(
        UnauthorizedError,
      );

      expect(repo.invalidateRefreshTokens).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('debe devolver el perfil con tercero y estudiante cuando existen', async () => {
      repo.findFullProfile.mockResolvedValue({
        id: 1,
        uuid: 'u1',
        email: 'est@test.com',
        roles: ['STUDENT'],
        cedula: '1102345678',
        nombre: 'Marwin Pérez',
        tercero: { nombre: 'Marwin Pérez', numeroDocumento: '1102345678' },
        estudiante: {
          codigoEstudiante: 'EST-2026-0001',
          programa: { nombre: 'Ingeniería de Sistemas', codigo: 'PRG-SIS' },
        },
        docente: null,
      });
      repo.findPermissions.mockResolvedValue([{ module: 'perfil', action: 'read' }]);

      const result = await service.getProfile(1);

      expect(result.email).toBe('est@test.com');
      expect(result.estudiante.codigoEstudiante).toBe('EST-2026-0001');
      expect(result.estudiante.programa.nombre).toBe('Ingeniería de Sistemas');
      expect(result.modulos).toEqual([{ modulo: 'perfil', acciones: ['read'] }]);
      expect(repo.findFullProfile).toHaveBeenCalledWith(1);
    });

    it('debe devolver el perfil sin datos académicos cuando no hay vínculo', async () => {
      repo.findFullProfile.mockResolvedValue({
        id: 1,
        uuid: 'u1',
        email: 'solo@test.com',
        roles: ['STUDENT'],
        cedula: null,
        nombre: 'Solo Auth',
        tercero: null,
        estudiante: null,
        docente: null,
      });

      const result = await service.getProfile(1);

      expect(result.tercero).toBeNull();
      expect(result.estudiante).toBeNull();
      expect(result.docente).toBeNull();
    });

    it('debe lanzar UnauthorizedError si el usuario no existe', async () => {
      repo.findFullProfile.mockResolvedValue(null);

      await expect(service.getProfile(999)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('requestPasswordReset', () => {
    it('debe retornar mensaje genérico aunque el email no exista', async () => {
      repo.findByEmail.mockResolvedValue(null);

      const result = await service.requestPasswordReset('noexist@test.com');
      expect(result.message).toBeDefined();
      expect(emailProducer.addJob).not.toHaveBeenCalled();
    });

    it('debe encolar email y crear token si el email existe', async () => {
      repo.findByEmail.mockResolvedValue({
        id: 1,
        email: 'test@test.com',
      });

      await service.requestPasswordReset('test@test.com');
      expect(emailProducer.addJob).toHaveBeenCalledWith(
        'send_reset_email',
        expect.objectContaining({
          email: 'test@test.com',
          userId: 1,
        }),
      );
      expect(repo.createPasswordResetToken).toHaveBeenCalled();
    });
  });

  describe('confirmPasswordReset', () => {
    it('debe actualizar la contraseña con token válido', async () => {
      repo.findPasswordResetToken.mockResolvedValue({
        userId: 1,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.confirmPasswordReset({
        token: 'valid-token',
        password: 'newpassword123',
      });

      expect(result.message).toBeDefined();
      expect(repo.updatePassword).toHaveBeenCalled();
      expect(repo.invalidateRefreshTokens).toHaveBeenCalledWith(1);
      expect(repo.deletePasswordResetToken).toHaveBeenCalled();
    });

    it('debe lanzar UnauthorizedError con token expirado', async () => {
      repo.findPasswordResetToken.mockResolvedValue(null);

      await expect(
        service.confirmPasswordReset({
          token: 'expired',
          password: 'newpass',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});
