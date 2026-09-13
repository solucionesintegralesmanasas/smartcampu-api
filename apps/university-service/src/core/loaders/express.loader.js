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
const terceroRoutes = require('../../modules/tercero/tercero.routes');

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
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Demasiadas peticiones, intente más tarde.' },
  });
  app.use('/api/', limiter);

  // Rutas en español (convención gateway /api/v1/universidad/...)
  app.use('/api/v1/universidad/empresas', empresaRoutes);
  app.use('/api/v1/universidad/terceros', terceroRoutes);
  app.use('/api/v1/universidad/facultades', facultadRoutes);
  app.use('/api/v1/universidad/programas', programaRoutes);
  app.use('/api/v1/universidad/estudiantes', estudianteRoutes);
  app.use('/api/v1/universidad/docentes', docenteRoutes);

  // Rutas en inglés / alias para compatibilidad
  app.use('/api/v1/university/companies', empresaRoutes);
  app.use('/api/v1/university/persons', terceroRoutes);
  app.use('/api/v1/university/faculties', facultadRoutes);
  app.use('/api/v1/university/programs', programaRoutes);
  app.use('/api/v1/university/students', estudianteRoutes);
  app.use('/api/v1/university/teachers', docenteRoutes);

  // Health checks
  const healthHandler = (req, res) => {
    res.status(200).json({
      status: 'UP',
      service: 'university-service',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  };

  app.get('/api/v1/universidad/health', healthHandler);
  app.get('/api/v1/university/health', healthHandler);
  app.get('/healthz', healthHandler);

  // Middleware global de manejo de errores
  app.use((err, req, res, _next) => {
    const statusCode = err.statusCode || 500;
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
      message: isProduction && statusCode === 500 ? 'Error interno del servidor' : err.message,
      ...(err.errors && { errors: err.errors }),
    });
  });
};

module.exports = expressLoader;
