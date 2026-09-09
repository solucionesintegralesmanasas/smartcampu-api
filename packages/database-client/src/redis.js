const Redis = require('ioredis');
const CircuitBreaker = require('opossum');

class RedisConnectionError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'RedisConnectionError';
    this.cause = cause;
  }
}

class RedisClient {
  constructor({
    host,
    port = 6379,
    password,
    db = 0,
    maxRetriesPerRequest = 3,
    connectTimeout = 10000,
    commandTimeout = 5000,
    maxAttempts = 10,
    logger = null,
  } = {}) {
    if (!host) throw new RedisConnectionError('host es obligatorio');

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      maxRetriesPerRequest,
      connectTimeout,
      commandTimeout,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > maxAttempts) return null;
        return Math.min(100 * 2 ** (times - 1), 5000) + Math.floor(Math.random() * 100);
      },
      reconnectOnError(err) {
        return ['READONLY', 'ECONNRESET', 'ETIMEDOUT'].some((t) => err.message.includes(t));
      },
    });

    this.breaker = new CircuitBreaker(async (command, ...args) => this.client[command](...args), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    });

    const log = (level, msg) => {
      const payload = {
        level,
        service: 'database-client',
        component: 'redis',
        message: msg,
        timestamp: new Date().toISOString(),
      };
      if (logger && typeof logger[level] === 'function') logger[level](msg);
      else console[level === 'error' ? 'error' : 'log'](JSON.stringify(payload));
    };

    this.client.on('connect', () => log('info', 'Redis connected'));
    this.client.on('ready', () => log('info', 'Redis ready'));
    this.client.on('error', (err) => log('error', `Redis error: ${err.message}`));
    this.client.on('reconnecting', () => log('warn', 'Redis reconnecting'));
  }

  async get(key) {
    return this.breaker.fire('get', key);
  }

  async set(key, value, ttl) {
    return ttl ? this.breaker.fire('setex', key, ttl, value) : this.breaker.fire('set', key, value);
  }

  async del(key) {
    return this.breaker.fire('del', key);
  }

  async ping() {
    try {
      return (await this.breaker.fire('ping')) === 'PONG';
    } catch {
      return false;
    }
  }

  async close() {
    await this.client.quit();
  }

  getBreakerStats() {
    const state = this.breaker.open ? 'OPEN' : this.breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED';
    return { state, stats: this.breaker.stats };
  }
}

const createRedisClient = (config) => new RedisClient(config);

module.exports = {
  createRedisClient,
  RedisClient,
  RedisConnectionError,
  pingRedis: async (client) => client.ping(),
  closeRedis: async (client) => client.close(),
};
