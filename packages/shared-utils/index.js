const constants = require('./src/constants');
const crypto = require('./src/crypto');
const logger = require('./src/logger');
const response = require('./src/response');
const { createTokenBucket } = require('./src/tokenBucket');

module.exports = {
  // Logger
  createLogger: logger.createLogger,

  // Crypto
  hashPassword: crypto.hashPassword,
  comparePassword: crypto.comparePassword,
  generateToken: crypto.generateToken,
  hashToken: crypto.hashToken,
  generateUuid: crypto.generateUuid,

  // Response
  formatSuccess: response.formatSuccess,
  formatError: response.formatError,
  formatPaginated: response.formatPaginated,

  // Constants
  ERROR_CODES: constants.ERROR_CODES,
  HTTP_STATUS: constants.HTTP_STATUS,
  TOKEN_TTLS: constants.TOKEN_TTLS,
  DEFAULT_PAGINATION: constants.DEFAULT_PAGINATION,
  MYSQL_ERROR_MAP: constants.MYSQL_ERROR_MAP,
  translateMysqlError: constants.translateMysqlError,

  // Rate Limiting
  createTokenBucket,
};
