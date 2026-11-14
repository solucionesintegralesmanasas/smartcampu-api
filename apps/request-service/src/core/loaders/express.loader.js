const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const logger = require('../../config/logger');
const catalogosRoutes = require('../../modules/catalogos/catalogos.routes');
const solicitudesRoutes = require('../../modules/solicitudes/solicitudes.routes');

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

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas solicitudes, intente más tarde.' },
  });
  app.use('/api/', limiter);

  app.use('/api/v1/solicitudes', catalogosRoutes);
  app.use('/api/v1/solicitudes', solicitudesRoutes);

  app.get('/healthz', (req, res) => {
    res.json({ status: 'UP', service: 'request-service', timestamp: new Date().toISOString() });
  });

  app.use((err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    logger.error('Error en la petición', {
      statusCode,
      message: err.message,
      path: req.path,
      method: req.method,
      ...(isProduction ? {} : { stack: err.stack }),
    });

    res.status(statusCode).json({
      success: false,
      message: isProduction && statusCode === 500 ? 'Error interno del servidor' : err.message,
      ...(err.errors && { errors: err.errors }),
    });
  });
};

module.exports = expressLoader;
