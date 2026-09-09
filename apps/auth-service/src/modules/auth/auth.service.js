const crypto = require('crypto');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { UnauthorizedError, ConflictError } = require('../../core/exceptions');

/**
 * Servicio de autenticación con lógica de negocio y registro de eventos en ES.
 */
class AuthService {
  /**
   * @param {import('./auth.repository')} authRepository - Repositorio de autenticación.
   * @param {import('../../jobs/producers/email.producer')} emailProducer - Productor de correos.
   */
  constructor(authRepository, emailProducer) {
    this.authRepository = authRepository;
    this.emailProducer = emailProducer;
  }

  async register(registerDto) {
    const existingUser = await this.authRepository.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictError('El correo electrónico ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, env.BCRYPT_ROUNDS);
    const user = await this.authRepository.create({
      ...registerDto,
      password: hashedPassword,
      uuid: uuidv4(),
      roles: registerDto.roles || ['STUDENT'],
    });

    await this.logAuthEvent('user_registered', {
      userId: user.id,
      email: user.email,
      status: 'success',
    });

    return {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      message: 'Registro exitoso',
    };
  }

  async login(loginDto, req) {
    const user = await this.authRepository.findByEmail(loginDto.email);
    if (!user) {
      await this.logAuthEvent('login_failed', {
        email: loginDto.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'user_not_found',
      });
      throw new UnauthorizedError('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isValid) {
      await this.logAuthEvent('login_failed', {
        userId: user.id,
        email: user.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'invalid_password',
      });
      throw new UnauthorizedError('Credenciales inválidas');
    }

    const permisos = await this.authRepository.findPermissions(user.roles || []);
    const modulos = this.buildModulos(permisos);

    const accessToken = jwt.sign(
      {
        sub: user.id,
        cedula: user.cedula || null,
        nombre: user.nombre || null,
        correo: user.email,
        rol: (user.roles && user.roles[0]) || null,
        modulos,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    const refreshToken = jwt.sign({ sub: user.id }, env.JWT_REFRESH_SECRET || env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    await this.authRepository.updateRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip,
    );

    await this.logAuthEvent('user_logged_in', {
      userId: user.id,
      email: user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'success',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        roles: user.roles || [],
        cedula: user.cedula || null,
        nombre: user.nombre || null,
        modulos,
      },
    };
  }

  buildModulos(permisos) {
    const porModulo = new Map();
    permisos.forEach(({ module: modulo, action }) => {
      if (!porModulo.has(modulo)) porModulo.set(modulo, new Set());
      porModulo.get(modulo).add(action);
    });
    return Array.from(porModulo.keys())
      .sort()
      .map((modulo) => ({
        modulo,
        acciones: Array.from(porModulo.get(modulo)).sort(),
      }));
  }

  async logout(logoutDto, req) {
    const user = await this.authRepository.findByRefreshToken(logoutDto.refreshToken);
    if (!user) {
      await this.logAuthEvent('logout_failed', {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'invalid_token',
      });
      throw new UnauthorizedError('Token de renovación inválido');
    }

    await this.authRepository.invalidateRefreshTokens(user.id);

    await this.logAuthEvent('user_logged_out', {
      userId: user.id,
      email: user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'success',
    });

    return { message: 'Sesión cerrada exitosamente' };
  }

  async refreshToken(refreshTokenDto) {
    const user = await this.authRepository.findByRefreshToken(refreshTokenDto.refreshToken);
    if (!user) {
      await this.logAuthEvent('refresh_failed', { status: 'invalid_token' });
      throw new UnauthorizedError('Token de renovación inválido');
    }

    try {
      jwt.verify(refreshTokenDto.refreshToken, env.JWT_REFRESH_SECRET || env.JWT_SECRET);
    } catch (error) {
      await this.logAuthEvent('refresh_failed', { userId: user.id, status: 'expired_token' });
      throw new UnauthorizedError('Token de renovación expirado');
    }

    const permisos = await this.authRepository.findPermissions(user.roles || []);
    const modulos = this.buildModulos(permisos);

    const accessToken = jwt.sign(
      {
        sub: user.id,
        cedula: user.cedula || null,
        nombre: user.nombre || null,
        correo: user.email,
        rol: (user.roles && user.roles[0]) || null,
        modulos,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    await this.logAuthEvent('token_refreshed', { userId: user.id, status: 'success' });

    return { accessToken, expiresIn: env.JWT_EXPIRES_IN };
  }

  async requestPasswordReset(email) {
    const GENERIC_MESSAGE = 'Si el correo existe, se ha enviado un enlace de restablecimiento';
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      return { message: GENERIC_MESSAGE };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.authRepository.createPasswordResetToken(user.id, resetTokenHash, expiresAt);

    await this.emailProducer.addJob('send_reset_email', {
      email: user.email,
      resetToken,
      userId: user.id,
    });

    await this.logAuthEvent('password_reset_requested', {
      userId: user.id,
      email: user.email,
      status: 'pending',
    });

    return { message: GENERIC_MESSAGE };
  }

  async confirmPasswordReset(confirmDto) {
    const tokenHash = crypto.createHash('sha256').update(confirmDto.token).digest('hex');
    const resetRequest = await this.authRepository.findPasswordResetToken(tokenHash);

    if (!resetRequest || resetRequest.expiresAt < new Date()) {
      throw new UnauthorizedError('Token de restablecimiento inválido o expirado');
    }

    const hashedPassword = await bcrypt.hash(confirmDto.password, env.BCRYPT_ROUNDS);
    await this.authRepository.updatePassword(resetRequest.userId, hashedPassword);
    await this.authRepository.invalidateRefreshTokens(resetRequest.userId);
    await this.authRepository.deletePasswordResetToken(tokenHash);

    await this.logAuthEvent('password_reset_completed', {
      userId: resetRequest.userId,
      status: 'success',
    });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async logAuthEvent(eventType, metadata) {
    try {
      await esClient.index({
        index: env.AUTH_EVENTS_INDEX,
        document: {
          '@timestamp': new Date().toISOString(),
          eventType,
          service: 'auth-service',
          correlationId: metadata.correlationId || uuidv4(),
          ...metadata,
        },
      });
    } catch (error) {
      logger.warn('Failed to log auth event to ES', { eventType, error: error.message });
    }
  }
}

module.exports = AuthService;
