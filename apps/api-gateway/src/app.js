require('express-async-errors');

const { formatError, ERROR_CODES } = require('@uajs/shared-utils');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');

const env = require('./config/env');
const authMiddleware = require('./middleware/auth.middleware');
const elasticsearchMiddleware = require('./middleware/elasticsearch.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');
const setupProxy = require('./middleware/proxy.middleware');
const createRateLimitMiddleware = require('./middleware/rateLimit.middleware');
const requestIdMiddleware = require('./middleware/requestId.middleware');
const healthRoutes = require('./routes/health.routes');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(requestIdMiddleware);
app.use(elasticsearchMiddleware);

app.use(healthRoutes);

app.use(authMiddleware);
app.use(createRateLimitMiddleware());

setupProxy(app);

app.use((req, res) => {
  res.status(404).json(
    formatError({
      code: ERROR_CODES.ROUTE_NOT_FOUND,
      message: `Ruta no encontrada: ${req.method} ${req.path}`,
      requestId: req.requestId,
    }),
  );
});

app.use(errorHandler);

module.exports = app;
