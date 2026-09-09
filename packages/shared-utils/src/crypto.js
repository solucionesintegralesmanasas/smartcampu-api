const crypto = require('node:crypto');

const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 10;
const DEFAULT_TOKEN_BYTES = 32;

/**
 * Hashea una contraseña en texto plano con bcrypt.
 *
 * @param {string} plain
 * @returns {Promise<string>}
 */
async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new TypeError('hashPassword: "plain" debe ser un string no vacío');
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Compara una contraseña en texto plano contra un hash bcrypt.
 *
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePassword(plain, hash) {
  if (typeof plain !== 'string' || typeof hash !== 'string') {
    throw new TypeError('comparePassword: "plain" y "hash" deben ser strings');
  }
  return bcrypt.compare(plain, hash);
}

/**
 * Genera un token aleatorio seguro (hex).
 *
 * @param {number} [bytes=32]
 * @returns {string}
 */
function generateToken(bytes = DEFAULT_TOKEN_BYTES) {
  if (!Number.isInteger(bytes) || bytes < 16) {
    throw new RangeError('generateToken: "bytes" debe ser entero >= 16');
  }
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hashea un token con SHA-256 (útil para almacenar tokens de forma segura en DB).
 *
 * @param {string} token
 * @returns {string}
 */
function hashToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError('hashToken: "token" debe ser un string no vacío');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Genera un UUID v4 usando la API nativa de Node.
 *
 * @returns {string}
 */
function generateUuid() {
  return crypto.randomUUID();
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  hashToken,
  generateUuid,
};
