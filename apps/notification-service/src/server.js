const initApp = require('./app');
const { env } = require('./config/env');
const { getMysqlPool } = require('./config/database/mysql');
const logger = require('./config/logger');
const { buildDispatcher } = require('./core/container');
const databaseLoader = require('./core/loaders/database.loader');
const DeliveryConsumer = require('./jobs/consumers/delivery.consumer');
const EventsConsumer = require('./jobs/consumers/events.consumer');

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
  let deliveryConsumer;
  let eventsConsumer;

  try {
    await databaseLoader();
    const app = initApp();

    const dispatcher = buildDispatcher();
    deliveryConsumer = new DeliveryConsumer(dispatcher);
    eventsConsumer = new EventsConsumer(dispatcher);

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
      logger.info(`notification-service escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
    });

    deliveryConsumer.start();
    eventsConsumer.start();
    logger.info('Consumidores de notificaciones iniciados');
  } catch (error) {
    logger.error('Fallo al iniciar notification-service', { error: error.message });
    process.exit(1);
  }

  const gracefulShutdown = async (signal) => {
    logger.info(`Señal ${signal} recibida. Iniciando apagado gradual...`);

    if (server) {
      server.close(async () => {
        logger.info('Servidor HTTP cerrado');
        try {
          if (deliveryConsumer) await deliveryConsumer.close();
          if (eventsConsumer) await eventsConsumer.close();
          await getMysqlPool().close();
          logger.info('Recursos cerrados');
        } catch (err) {
          logger.error('Error cerrando recursos', { error: err.message });
        }
        process.exit(0);
      });
    }

    setTimeout(() => {
      logger.error('Tiempo de apagado excedido. Forzando salida.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer();
