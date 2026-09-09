const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const tokenBucket = require('./core/rateLimiter/tokenBucket');

const { PORT } = env;

const server = app.listen(PORT, () => {
  logger.info(`API Gateway escuchando en puerto ${PORT} (${env.NODE_ENV})`);
});

function gracefulShutdown(signal) {
  logger.info(`Senal ${signal} recibida. Iniciando apagado ordenado...`);

  server.close((err) => {
    if (err) {
      logger.error('Error al cerrar el servidor HTTP', { error: err.message });
      process.exit(1);
    }

    logger.info('Servidor HTTP cerrado.');
    tokenBucket.stop();
    logger.info('Recursos liberados. Saliendo.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Tiempo de apagado agotado. Forzando salida.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
