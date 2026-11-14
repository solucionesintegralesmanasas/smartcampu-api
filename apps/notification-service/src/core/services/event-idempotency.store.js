const { env } = require('../../config/env');
const { getRedisClient } = require('../../config/database/redis');

/** Tiempo máximo que un evento queda reclamado mientras se procesa (segundos). */
const PROCESSING_TTL_SECONDS = 300;
const PREFIJO = 'notif:evento:';

/**
 * Idempotencia por `envelope.eventId`, respaldada en Redis.
 *
 * La tabla de notificaciones no tiene columna para el eventId, por eso se usa una clave con
 * SET NX: `claim` reclama el evento (estado 'processing'), `complete` lo marca como
 * procesado durante NOTIFICATION_IDEMPOTENCY_TTL segundos y `release` libera el reclamo si
 * el procesamiento falla, para que el reintento de BullMQ pueda continuar.
 */
class EventIdempotencyStore {
  /**
   * @param {Object} [redis] - Cliente Redis (wrapper de @uajs/database-client). Por defecto, el singleton.
   * @param {number} [ttl] - Segundos que se conserva un evento ya procesado.
   */
  constructor(redis = null, ttl = env.NOTIFICATION_IDEMPOTENCY_TTL) {
    this.redis = redis;
    this.ttl = ttl;
  }

  getClient() {
    const wrapper = this.redis || getRedisClient();
    return wrapper.client;
  }

  /**
   * @param {string} eventId
   * @returns {Promise<boolean>} true si se obtuvo el reclamo; false si ya fue procesado o está en curso.
   */
  async claim(eventId) {
    const resultado = await this.getClient().set(
      `${PREFIJO}${eventId}`,
      'processing',
      'EX',
      PROCESSING_TTL_SECONDS,
      'NX',
    );
    return resultado === 'OK';
  }

  async complete(eventId) {
    await this.getClient().set(`${PREFIJO}${eventId}`, 'done', 'EX', this.ttl);
  }

  async release(eventId) {
    await this.getClient().del(`${PREFIJO}${eventId}`);
  }
}

module.exports = EventIdempotencyStore;
