const initApp = require('./app');
const { env } = require('./config/env');
const logger = require('./config/logger');
const databaseLoader = require('./core/loaders/database.loader');
const UniversityConsumer = require('./jobs/consumers/university.consumer');

process.on('uncaughtException', (err) => {
  logger.error('Excepción no capturada en university-service', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Rechazo no manejado en university-service', { reason: String(reason) });
  process.exit(1);
});

const startServer = async () => {
  let server;
  let universityConsumer;

  try {
    await databaseLoader();
    const app = initApp();

    try {
      universityConsumer = new UniversityConsumer();
      logger.info('Consumidor BullMQ de eventos universitarios iniciado');
    } catch (consumerErr) {
      logger.warn('No se pudo inicializar el consumidor BullMQ en arranque (no fatal)', {
        error: consumerErr.message,
      });
    }

    server = app.listen(env.PORT);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`El puerto ${env.PORT} ya está en uso`);
      } else {
        logger.error('Error en el servidor HTTP', { error: err.message });
      }
      process.exit(1);
    });

    server.on('listening', () => {
      logger.info(`university-service escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (error) {
    logger.error('Fallo al iniciar university-service', { error: error.message });
    process.exit(1);
  }

  const gracefulShutdown = async (signal) => {
    logger.info(`Señal ${signal} recibida. Iniciando apagado gradual (graceful shutdown)...`);

    if (server) {
      server.close(async () => {
        logger.info('Servidor HTTP cerrado');
        try {
          if (universityConsumer) await universityConsumer.close();
          logger.info('Consumidor de eventos universitarios cerrado');
        } catch (err) {
          logger.error('Error cerrando consumidor de eventos', { error: err.message });
        }
        process.exit(0);
      });
    }

    setTimeout(() => {
      logger.error('Tiempo de espera de apagado excedido. Forzando salida.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer();
