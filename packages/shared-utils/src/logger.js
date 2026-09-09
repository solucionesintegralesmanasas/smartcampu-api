const winston = require('winston');

const {
  combine, timestamp, json, printf, colorize, errors, splat,
} = winston.format;

/**
 * Formato legible para desarrollo (printf con color).
 */
const devFormat = printf(({
  level, message, service, timestamp: ts, requestId, ...meta
}) => {
  const reqId = requestId ? ` [req:${requestId}]` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${service}] ${level}:${reqId} ${message}${metaStr}`;
});

/**
 * Crea un logger Winston con formato JSON en producción y legible en desarrollo.
 *
 * @param {object} opts
 * @param {string} opts.service - Nombre del servicio (aparece en cada línea).
 * @param {string} [opts.level='info'] - Nivel mínimo (error|warn|info|http|debug).
 * @param {boolean} [opts.isProduction] - Fuerza modo prod/dev. Si no se indica,
 *   se infiere de NODE_ENV.
 * @returns {winston.Logger}
 */
function createLogger({ service, level = 'info', isProduction } = {}) {
  if (!service) {
    throw new Error('createLogger: "service" es obligatorio');
  }

  const env = process.env.NODE_ENV || 'development';
  const prod = isProduction !== undefined ? isProduction : env === 'production';

  const baseFormat = [
    errors({ stack: true }),
    splat(),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  ];

  const format = prod
    ? combine(...baseFormat, json())
    : combine(...baseFormat, colorize(), devFormat);

  const logger = winston.createLogger({
    level,
    levels: winston.config.npm.levels, // incluye http
    defaultMeta: { service },
    format,
    transports: [
      new winston.transports.Console({
        handleExceptions: true,
        handleRejections: true,
      }),
    ],
    exitOnError: false,
  });

  /**
   * Crea un logger hijo que propaga `requestId` (trazabilidad) y metadatos extra.
   *
   * @param {object} childMeta - p.ej. { requestId, userId }
   * @returns {winston.Logger}
   */
  logger.child = function childLogger(childMeta = {}) {
    return winston.createLogger({
      level: logger.level,
      levels: logger.levels,
      defaultMeta: { ...logger.defaultMeta, ...childMeta },
      format: logger.format,
      transports: logger.transports,
      exitOnError: false,
    });
  };

  return logger;
}

module.exports = { createLogger };
