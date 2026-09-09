/**
 * Algoritmo Token Bucket genérico en memoria.
 *
 * ⚠️  LIMITACIÓN IMPORTANTE:
 * Este bucket es LOCAL al proceso. Para despliegues multi-réplica se requiere
 * un store compartido (Redis + Lua script recomendado). En una sola réplica
 * es thread-safe porque Node.js es single-threaded por event-loop.
 *
 * Contrato `consume(key, cost)`:
 *   - Si hay tokens suficientes: descuenta `cost`, retorna allowed=true.
 *   - Si no hay suficientes: NO descuenta, retorna allowed=false y
 *     retryAfterSeconds = ceil((cost - available) / refillPerSecond).
 *
 * @module tokenBucket
 */

/**
 * @typedef {Object} ConsumeResult
 * @property {boolean} allowed           - true si se permitió el consumo.
 * @property {number}  remaining         - tokens disponibles tras la operación.
 * @property {number|null} retryAfterSeconds - segundos a esperar si fue denegado.
 */

/**
 * @typedef {Object} TokenBucketConfig
 * @property {number} capacity           - Capacidad máxima de tokens por bucket.
 * @property {number} refillPerSecond    - Tokens añadidos por segundo.
 * @property {number} [sweepIntervalMs=60000] - Intervalo de barrido de buckets inactivos.
 * @property {number} [idleThresholdMs]  - Bucket inactivo tras este tiempo se barre.
 *                                          Por defecto = sweepIntervalMs * 2.
 */

/**
 * Crea una instancia de Token Bucket.
 *
 * @param {TokenBucketConfig} config
 * @returns {{ consume: Function, getRemaining: Function, sweep: Function, stop: Function }}
 */
function createTokenBucket({
  capacity,
  refillPerSecond,
  sweepIntervalMs = 60000,
  idleThresholdMs,
}) {
  if (!Number.isFinite(capacity) || capacity <= 0) {
    throw new RangeError('createTokenBucket: "capacity" debe ser un número > 0');
  }
  if (!Number.isFinite(refillPerSecond) || refillPerSecond <= 0) {
    throw new RangeError('createTokenBucket: "refillPerSecond" debe ser un número > 0');
  }
  if (!Number.isFinite(sweepIntervalMs) || sweepIntervalMs <= 0) {
    throw new RangeError('createTokenBucket: "sweepIntervalMs" debe ser un número > 0');
  }

  const idleThreshold = idleThresholdMs ?? sweepIntervalMs * 2;

  /** @type {Map<string, { tokens: number, lastRefill: number, lastAccess: number }>} */
  const buckets = new Map();

  /**
   * Refill perezoso: recalcula los tokens disponibles según el tiempo transcurrido.
   *
   * @param {{ tokens: number, lastRefill: number }} bucket
   * @param {number} nowMs
   * @returns {number} tokens actuales (sin modificar el bucket todavía)
   */
  function computeTokens(bucket, nowMs) {
    const elapsedMs = nowMs - bucket.lastRefill;
    if (elapsedMs <= 0) return bucket.tokens;
    const added = (elapsedMs / 1000) * refillPerSecond;
    return Math.min(capacity, bucket.tokens + added);
  }

  /**
   * Consume `cost` tokens para la `key` dada.
   *
   * @param {string} key       - Identificador (IP, userId, correo+IP, etc.).
   * @param {number} [cost=1]  - Coste de la operación.
   * @returns {ConsumeResult}
   */
  function consume(key, cost = 1) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('consume: "key" debe ser un string no vacío');
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      throw new RangeError('consume: "cost" debe ser un número > 0');
    }

    const now = Date.now();
    let bucket = buckets.get(key);

    // Inicialización: primera vez que se ve la key
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now, lastAccess: now };
      buckets.set(key, bucket);
    }

    // Refill perezoso
    const available = computeTokens(bucket, now);

    if (available >= cost) {
      // Permitido: descontar y actualizar timestamps
      bucket.tokens = available - cost;
      bucket.lastRefill = now;
      bucket.lastAccess = now;
      return {
        allowed: true,
        remaining: bucket.tokens,
        retryAfterSeconds: null,
      };
    }

    // Denegado: NO descontar, solo actualizar lastAccess
    bucket.lastAccess = now;
    const deficit = cost - available;
    const retryAfterSeconds = Math.ceil(deficit / refillPerSecond);

    return {
      allowed: false,
      remaining: available,
      retryAfterSeconds,
    };
  }

  /**
   * Devuelve los tokens actuales disponibles para una key (con refill perezoso).
   *
   * @param {string} key
   * @returns {number}
   */
  function getRemaining(key) {
    const bucket = buckets.get(key);
    if (!bucket) return capacity; // key inexistente = bucket lleno
    return computeTokens(bucket, Date.now());
  }

  /**
   * Elimina buckets inactivos (sin acceso en los últimos `idleThreshold` ms).
   *
   * @returns {number} cantidad de buckets eliminados.
   */
  function sweep() {
    const now = Date.now();
    let removed = 0;
    buckets.forEach((bucket, key) => {
      if (now - bucket.lastAccess >= idleThreshold) {
        buckets.delete(key);
        removed += 1;
      }
    });
    return removed;
  }

  // Barrido periódico automático
  const sweepTimer = setInterval(() => {
    try {
      sweep();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[tokenBucket] sweep error:', err?.message);
    }
  }, sweepIntervalMs);

  // Permitir que el proceso termine aunque el timer siga activo
  if (typeof sweepTimer.unref === 'function') {
    sweepTimer.unref();
  }

  /**
   * Detiene el barrido periódico. Llamar en graceful shutdown.
   */
  function stop() {
    clearInterval(sweepTimer);
    buckets.clear();
  }

  return {
    consume,
    getRemaining,
    sweep,
    stop,
  };
}

module.exports = { createTokenBucket };
