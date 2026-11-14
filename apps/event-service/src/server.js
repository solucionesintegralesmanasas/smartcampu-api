const initApp = require('./app');
const { env } = require('./config/env');
const logger = require('./config/logger');
const { closeMysqlPool } = require('./config/database/mysql');
const { closeRedisClient } = require('./config/database/redis');
const { closeQueues } = require('./config/queues');
const databaseLoader = require('./core/loaders/database.loader');

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
  process.exit(1);
});

const startServer = async () => {
  let server;

  try {
    await databaseLoader();
    const app = initApp();

    server = app.listen(env.PORT);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${env.PORT} already in use`);
      } else {
        logger.error('Server error', { error: err.message });
      }
      process.exit(1);
    });

    server.on('listening', () => {
      logger.info(`event-service running on port ${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (error) {
    logger.error('Failed to start event-service', { error: error.message });
    process.exit(1);
  }

  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    if (server) {
      server.close(async () => {
        logger.info('HTTP server closed');
        try {
          await closeQueues();
          await closeRedisClient();
          await closeMysqlPool();
          logger.info('Recursos cerrados correctamente');
        } catch (err) {
          logger.error('Error closing resources', { error: err.message });
        }
        process.exit(0);
      });
    }

    setTimeout(() => {
      logger.error('Shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer();
