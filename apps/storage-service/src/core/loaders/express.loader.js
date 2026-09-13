const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const logger = require('../../config/logger');
const archivoRoutes = require('../../modules/archivo/archivo.routes');

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
    message: { success: false, message: 'Too many requests, please try again later.' },
  });
  app.use('/api/', limiter);

  app.use('/api/v1/storage', archivoRoutes);

  app.get('/healthz', (req, res) => {
    res.json({ status: 'UP', service: 'storage-service', timestamp: new Date().toISOString() });
  });

  app.use((err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    logger.error('Request error', {
      statusCode,
      message: err.message,
      path: req.path,
      method: req.method,
      ...(isProduction ? {} : { stack: err.stack }),
    });

    res.status(statusCode).json({
      success: false,
      message: isProduction && statusCode === 500 ? 'Internal server error' : err.message,
      ...(err.errors && { errors: err.errors }),
    });
  });
};

module.exports = expressLoader;
