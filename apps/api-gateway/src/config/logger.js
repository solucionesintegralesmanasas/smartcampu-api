const { createLogger } = require('@uajs/shared-utils');

const env = require('./env');

module.exports = createLogger({
  service: 'api-gateway',
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  isProduction: env.NODE_ENV === 'production',
});
