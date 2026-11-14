const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const logger = require('../../config/logger');
const categoriesRoutes = require('../../modules/categories/categories.routes');
const resourcesRoutes = require('../../modules/resources/resources.routes');
const statusesRoutes = require('../../modules/statuses/statuses.routes');

/**
 * Traducción de errores de MySQL a respuestas HTTP comprensibles.
 */
const DATABASE_ERRORS = Object.freeze({
  ER_DUP_ENTRY: { statusCode: 409, message: 'Ya existe un registro con esos datos' },
  ER_ROW_IS_REFERENCED_2: {
    statusCode: 409,
    message: 'No se puede eliminar porque tiene registros asociados',
  },
  ER_NO_REFERENCED_ROW_2: {
    statusCode: 400,
    message: 'Una de las referencias enviadas no existe',
  },
});

const expressLoader = (app) => {
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

  // El gateway reenvía todas las peticiones desde una misma IP; el límite es amplio a propósito.
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' },
  });
  app.use('/api/', limiter);

  app.use('/api/v1/recursos/categorias', categoriesRoutes);
  app.use('/api/v1/recursos/estados', statusesRoutes);
  app.use('/api/v1/recursos', resourcesRoutes);

  app.get('/healthz', (req, res) => {
    res.json({ status: 'UP', service: 'resource-service', timestamp: new Date().toISOString() });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Ruta no encontrada' });
  });

  app.use((err, req, res, _next) => {
    const dbError = DATABASE_ERRORS[err.code];
    const statusCode = dbError?.statusCode || err.statusCode || err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    if (statusCode >= 500) {
      logger.error('Request error', {
        statusCode,
        message: err.message,
        path: req.path,
        method: req.method,
        ...(isProduction ? {} : { stack: err.stack }),
      });
    }

    let message = err.message;
    if (dbError) {
      message = dbError.message;
    } else if (isProduction && statusCode === 500) {
      message = 'Internal server error';
    }

    res.status(statusCode).json({
      success: false,
      message,
      ...(err.errors && { errors: err.errors }),
    });
  });
};

module.exports = expressLoader;
