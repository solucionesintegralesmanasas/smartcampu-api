const { createRedisClient } = require('@uajs/database-client');
const { translateMysqlError } = require('@uajs/shared-utils');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const { env } = require('../../config/env');
const logger = require('../../config/logger');
const notificacionRoutes = require('../../modules/notificacion/notificacion.routes');
const plantillaRoutes = require('../../modules/plantilla/plantilla.routes');
const preferenciaRoutes = require('../../modules/preferencia/preferencia.routes');
const suscripcionRoutes = require('../../modules/suscripcion/suscripcion.routes');
const identityMiddleware = require('../middleware/identity.middleware');

const expressLoader = (app) => {
  app.locals.redisClient = createRedisClient({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  });

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim())
        : '*',
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  });
  app.use('/api/', limiter);

  app.use(identityMiddleware);

  // Registrado antes de montar las rutas de recursos, para que ningún
  // "/:id" le gane la carrera a "/health".
  app.get('/api/v1/notifications/health', (req, res) => {
    res.json({
      status: 'UP', service: 'notification-service', timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1/notifications/plantillas', plantillaRoutes);
  app.use('/api/v1/notifications/preferencias', preferenciaRoutes);
  app.use('/api/v1/notifications/suscripciones', suscripcionRoutes);
  app.use('/api/v1/notifications', notificacionRoutes);

  app.use((err, req, res, _next) => {
    const isMysqlError = !err.statusCode && Boolean(err.code);
    const translated = isMysqlError ? translateMysqlError(err) : null;

    const statusCode = translated?.statusCode || err.statusCode || 500;
    const message = translated?.message || err.message;
    const isProduction = process.env.NODE_ENV === 'production';

    logger.error('Notification error', {
      statusCode,
      message: err.message,
      mysqlCode: err.code,
      path: req.path,
      method: req.method,
      ...(isProduction ? {} : { stack: err.stack }),
    });

    res.status(statusCode).json({
      success: false,
      message: isProduction && statusCode === 500 ? 'Internal server error' : message,
      ...(err.errors && { errors: err.errors }),
    });
  });
};

module.exports = expressLoader;
