const { createRedisClient } = require('@uajs/database-client');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');

const { env } = require('../../config/env');
const logger = require('../../config/logger');
const campusRoutes = require('../../modules/campus/campus.routes');
const cityRoutes = require('../../modules/city/city.routes');
const departmentRoutes = require('../../modules/department/department.routes');
const documentTypeRoutes = require('../../modules/document-type/document-type.routes');

const expressLoader = (app) => {
  app.locals.redisClient = createRedisClient({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  });

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

  app.use('/api/v1/catalog/departments', departmentRoutes);
  app.use('/api/v1/catalog/cities', cityRoutes);
  app.use('/api/v1/catalog/campuses', campusRoutes);
  app.use('/api/v1/catalog/document-types', documentTypeRoutes);

  app.get('/api/v1/catalog/health', (req, res) => {
    res.json({ status: 'UP', service: 'catalog-service', timestamp: new Date().toISOString() });
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
