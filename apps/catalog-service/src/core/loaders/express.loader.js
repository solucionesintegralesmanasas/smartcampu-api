const { createRedisClient } = require('@uajs/database-client');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const { env } = require('../../config/env');
const logger = require('../../config/logger');
const campusRoutes = require('../../modules/campus/campus.routes');
const cityRoutes = require('../../modules/city/city.routes');
const countryRoutes = require('../../modules/country/country.routes');
const departmentRoutes = require('../../modules/department/department.routes');
const documentTypeRoutes = require('../../modules/document-type/document-type.routes');
const { ValidationError } = require('../exceptions');
const { mapDatabaseError } = require('../helpers/database-error.helper');

const toHttpError = (err) => {
  const dbError = mapDatabaseError(err);
  if (dbError) return dbError;
  if (err.type === 'entity.parse.failed') {
    return new ValidationError('El cuerpo de la petición no es un JSON válido');
  }
  return err;
};

const expressLoader = (app) => {
  app.locals.redisClient = createRedisClient({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  });

  app.use(helmet());

  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : '*';

  app.use(
    cors({
      origin: corsOrigins,
      credentials: corsOrigins !== '*',
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas peticiones, intente más tarde.' },
  });
  app.use('/api/', limiter);

  app.use('/api/v1/catalog/paises', countryRoutes);
  app.use('/api/v1/catalog/departments', departmentRoutes);
  app.use('/api/v1/catalog/cities', cityRoutes);
  app.use('/api/v1/catalog/campuses', campusRoutes);
  app.use('/api/v1/catalog/document-types', documentTypeRoutes);

  const healthHandler = (req, res) => {
    res.status(200).json({
      status: 'UP',
      service: 'catalog-service',
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/healthz', healthHandler);
  app.get('/api/v1/catalog/health', healthHandler);

  app.use((err, req, res, _next) => {
    const error = toHttpError(err);
    const statusCode = error.statusCode || 500;
    const isProduction = env.NODE_ENV === 'production';

    logger.error('Error en procesamiento de petición', {
      statusCode,
      message: err.message,
      path: req.path,
      method: req.method,
      ...(isProduction ? {} : { stack: err.stack }),
    });

    res.status(statusCode).json({
      success: false,
      message: isProduction && statusCode === 500 ? 'Error interno del servidor' : error.message,
      ...(error.errors && { errors: error.errors }),
    });
  });
};

module.exports = expressLoader;
