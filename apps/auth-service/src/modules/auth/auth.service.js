const crypto = require('crypto');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const { esClient } = require('../../config/elasticsearch');
const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { UnauthorizedError, ConflictError } = require('../../core/exceptions');

// Hash bcrypt válido y fijo (no corresponde a ninguna contraseña real), usado
// solo para igualar el costo de tiempo de bcrypt.compare cuando el usuario no
// existe. Sin esto, "usuario no existe" responde antes que "password
// incorrecta" y un atacante puede enumerar correos registrados por temporización.
const DUMMY_PASSWORD_HASH = '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW';

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

    // Siempre se ejecuta bcrypt.compare, exista o no el usuario (contra un
    // hash fijo cuando no existe), para que ambas ramas cuesten lo mismo.
    const isValid = await bcrypt.compare(loginDto.password, user ? user.password : DUMMY_PASSWORD_HASH);

    if (!user || !isValid) {
      await this.logAuthEvent('login_failed', {
        userId: user ? user.id : undefined,
        email: user ? user.email : loginDto.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: user ? 'invalid_password' : 'user_not_found',
      });
      throw new UnauthorizedError('Credenciales inválidas');
    }

    const permisos = await this.authRepository.findPermissions(user.roles || []);
    const modulos = this.buildModulos(permisos);

    const accessToken = jwt.sign(
      {
        sub: user.id,
        uuid: user.uuid,
        cedula: user.cedula || null,
        nombre: user.nombre || null,
        correo: user.email,
        rol: (user.roles && user.roles[0]) || null,
        // api-gateway (auth.middleware.js) exige un array `roles` para
        // autorizar el token; `rol` (singular) se conserva solo por
        // compatibilidad con el resto del payload.
        roles: user.roles || [],
        modulos,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    // `jti` garantiza unicidad: sin él el payload es solo {sub, iat, exp} con
    // iat en segundos, así que dos tokens emitidos en el mismo segundo son
    // bytes idénticos y el UNIQUE de refresh_tokens.token_hash respondía
    // 500 Duplicate entry (DEF-02 corregido).
    const refreshToken = jwt.sign({ sub: user.id, jti: uuidv4() }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    await this.authRepository.createRefreshToken(user.id, refreshToken, {
      deviceInfo: req.headers['user-agent'],
      ipAddress: req.ip,
    });

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

    // Revoca solo la sesión/dispositivo del token presentado, no todas las
    // sesiones del usuario (de lo contrario cerrar sesión en un dispositivo
    // desconectaría también todos los demás dispositivos del usuario).
    await this.authRepository.revokeRefreshTokenByHash(logoutDto.refreshToken, 'logout');

    await this.logAuthEvent('user_logged_out', {
      userId: user.id,
      email: user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'success',
    });

    return { message: 'Sesión cerrada exitosamente' };
  }

  async refreshToken(refreshTokenDto, req) {
    const record = await this.authRepository.findRefreshTokenRecord(refreshTokenDto.refreshToken);
    if (!record) {
      await this.logAuthEvent('refresh_failed', { status: 'unknown_token' });
      throw new UnauthorizedError('Token de renovación inválido');
    }

    if (record.revokedAt) {
      // El token ya fue usado (rotado) o cerrado antes: si vuelve a
      // presentarse, es un indicio de robo. Se revoca toda la familia de
      // tokens del dispositivo/sesión para forzar un nuevo login.
      await this.authRepository.revokeRefreshTokenFamily(record.familyId, 'theft');
      await this.logAuthEvent('refresh_reuse_detected', {
        userId: record.userId,
        familyId: record.familyId,
        status: 'theft_suspected',
      });
      throw new UnauthorizedError('Token de renovación inválido');
    }

    if (record.expiresAt < new Date()) {
      await this.logAuthEvent('refresh_failed', { userId: record.userId, status: 'expired_token' });
      throw new UnauthorizedError('Token de renovación expirado');
    }

    try {
      jwt.verify(refreshTokenDto.refreshToken, env.JWT_REFRESH_SECRET);
    } catch (error) {
      await this.logAuthEvent('refresh_failed', { userId: record.userId, status: 'invalid_signature' });
      throw new UnauthorizedError('Token de renovación inválido');
    }

    const user = await this.authRepository.findById(record.userId);
    if (!user) {
      await this.logAuthEvent('refresh_failed', { userId: record.userId, status: 'user_not_found' });
      throw new UnauthorizedError('Token de renovación inválido');
    }

    const permisos = await this.authRepository.findPermissions(user.roles || []);
    const modulos = this.buildModulos(permisos);

    const accessToken = jwt.sign(
      {
        sub: user.id,
        uuid: user.uuid,
        cedula: user.cedula || null,
        nombre: user.nombre || null,
        correo: user.email,
        rol: (user.roles && user.roles[0]) || null,
        roles: user.roles || [],
        modulos,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    const newRefreshToken = jwt.sign({ sub: user.id, jti: uuidv4() }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    // Rotación: se revoca el token usado y se emite uno nuevo en la misma
    // familia, para poder detectar un reuso posterior (robo) del anterior.
    await this.authRepository.revokeRefreshTokenById(record.id, 'rotation');
    await this.authRepository.createRefreshToken(user.id, newRefreshToken, {
      deviceInfo: req?.headers?.['user-agent'],
      ipAddress: req?.ip,
      familyId: record.familyId,
    });

    await this.logAuthEvent('token_refreshed', { userId: user.id, status: 'success' });

    return { accessToken, refreshToken: newRefreshToken, expiresIn: env.JWT_EXPIRES_IN };
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
    const indexPromise = esClient.index({
      index: env.AUTH_EVENTS_INDEX,
      document: {
        '@timestamp': new Date().toISOString(),
        eventType,
        service: 'auth-service',
        correlationId: metadata.correlationId || uuidv4(),
        ...metadata,
      },
    });

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ __timedOut: true }), 2000);
    });

    try {
      const result = await Promise.race([indexPromise, timeoutPromise]);
      if (result && result.__timedOut) {
        logger.warn('Timed out logging auth event to ES', { eventType });
        indexPromise.catch(() => {});
      }
    } catch (error) {
      logger.warn('Failed to log auth event to ES', { eventType, error: error.message });
    }
  }
}

module.exports = AuthService;
