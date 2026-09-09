const { createTokenBucket } = require('@uajs/shared-utils');

const env = require('../../config/env');

// Instancia singleton para el proceso del gateway
const bucket = createTokenBucket({
  capacity: env.RATE_LIMIT_BUCKET_CAPACITY,
  refillPerSecond: env.RATE_LIMIT_REFILL_PER_SEC,
  sweepIntervalMs: 60000, // 1 minuto
});

module.exports = bucket;
