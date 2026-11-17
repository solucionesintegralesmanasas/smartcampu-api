const { createRedisClient } = require('@uajs/database-client');
const { translateMysqlError } = require('@uajs/shared-utils');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const { env } = require('../../config/env');
const logger = require('../../config/logger');
const docenteRoutes = require('../../modules/docente/docente.routes');
const empresaRoutes = require('../../modules/empresa/empresa.routes');
const estudianteRoutes = require('../../modules/estudiante/estudiante.routes');
const facultadRoutes = require('../../modules/facultad/facultad.routes');
const programaRoutes = require('../../modules/programa/programa.routes');
const sedeRoutes = require('../../modules/sede/sede.routes');
const terceroRoutes = require('../../modules/tercero/tercero.routes');
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
  // "/:id" les gane la carrera a "/health" (ver el mismo bug corregido en
  // user-service).
  app.get('/api/v1/university/health', (req, res) => {
    res.json({ status: 'UP', service: 'university-service', timestamp: new Date().toISOString() });
  });

  app.use('/api/v1/university/sedes', sedeRoutes);
  app.use('/api/v1/university/empresas', empresaRoutes);
  app.use('/api/v1/university/terceros', terceroRoutes);
  app.use('/api/v1/university/facultades', facultadRoutes);
  app.use('/api/v1/university/programas', programaRoutes);
  app.use('/api/v1/university/estudiantes', estudianteRoutes);
  app.use('/api/v1/university/docentes', docenteRoutes);

  app.use((err, req, res, _next) => {
    const isMysqlError = !err.statusCode && Boolean(err.code);
    const translated = isMysqlError ? translateMysqlError(err) : null;

    const statusCode = translated?.statusCode || err.statusCode || 500;
    const message = translated?.message || err.message;
    const isProduction = process.env.NODE_ENV === 'production';

    logger.error('Request error', {
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
