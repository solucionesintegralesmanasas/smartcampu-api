const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');

const { env } = require('./env');

/**
 * Configuración del logger con transporte a consola y Elasticsearch.
 */
const esTransportOpts = {
  level: 'info',
  clientOpts: {
    node: `http://${env.ELASTICSEARCH_HOST}:${env.ELASTICSEARCH_PORT}`,
    auth: {
      username: env.ELASTICSEARCH_USER,
      password: env.ELASTICSEARCH_PASSWORD,
    },
  },
  indexPrefix: 'uajs-logs',
};

const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new ElasticsearchTransport(esTransportOpts),
  ],
});

module.exports = logger;
