const mysql = require('mysql2/promise');
const CircuitBreaker = require('opossum');

class MysqlConnectionError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = 'MysqlConnectionError';
    this.cause = cause;
  }
}

class MysqlPoolExhaustedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MysqlPoolExhaustedError';
  }
}

class MySQLPool {
  constructor({
    host,
    port = 3306,
    user,
    password,
    database,
    connectionLimit = 20,
    queueLimit = 0,
    connectTimeout = 10000,
  } = {}) {
    if (!host || !user || !database) {
      throw new MysqlConnectionError('host, user y database son obligatorios');
    }

    this.pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      connectionLimit,
      queueLimit,
      connectTimeout,
      waitForConnections: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      timezone: 'Z',
      charset: 'utf8mb4',
      multipleStatements: false,
    });

    this.breaker = new CircuitBreaker(
      async (query, params) => {
        const conn = await this.pool.getConnection();
        try {
          const [results] = await conn.query(query, params);
          return results;
        } finally {
          conn.release();
        }
      },
      {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 60000,
      },
    );

    this.breaker.on('open', () => console.warn('[MySQL CircuitBreaker] OPEN'));
    this.breaker.on('halfOpen', () => console.info('[MySQL CircuitBreaker] HALF-OPEN'));
    this.breaker.on('close', () => console.info('[MySQL CircuitBreaker] CLOSED'));

    this.pool.on('error', (err) => {
      console.error(
        JSON.stringify({
          level: 'error',
          service: 'database-client',
          component: 'mysql',
          message: 'MySQL pool error',
          error: err?.message,
          timestamp: new Date().toISOString(),
        }),
      );
    });
  }

  async getConnection() {
    let attempt = 0;
    while (attempt < 5) {
      try {
        return await this.pool.getConnection();
      } catch (err) {
        attempt++;
        const fatalCodes = [
          'ER_ACCESS_DENIED_ERROR',
          'ER_BAD_DB_ERROR',
          'ER_DBACCESS_DENIED_ERROR',
        ];
        if (fatalCodes.includes(err?.code)) throw new MysqlConnectionError(`Fatal: ${err.message}`, err);
        if (attempt >= 5) throw new MysqlConnectionError(`Failed after ${attempt} retries: ${err.message}`, err);
        await new Promise((r) => setTimeout(r, Math.min(200 * 2 ** (attempt - 1), 5000)));
      }
    }
  }

  async query(sql, params = []) {
    try {
      return await this.breaker.fire(sql, params);
    } catch (error) {
      if (this.breaker.open) {
        const conn = await this.getConnection();
        try {
          const [results] = await conn.query(sql, params);
          return results;
        } finally {
          conn.release();
        }
      }
      throw error;
    }
  }

  async execute(sql, params = []) {
    const conn = await this.getConnection();
    try {
      const [results] = await conn.execute(sql, params);
      return results;
    } finally {
      conn.release();
    }
  }

  async beginTransaction() {
    const conn = await this.getConnection();
    await conn.beginTransaction();
    return conn;
  }

  async ping() {
    try {
      await this.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }

  getBreakerStats() {
    const state = this.breaker.open ? 'OPEN' : this.breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED';
    return { state, stats: this.breaker.stats };
  }
}

const createMysqlPool = (config) => new MySQLPool(config);

module.exports = {
  createMysqlPool,
  MySQLPool,
  MysqlConnectionError,
  MysqlPoolExhaustedError,
  pingPool: async (pool) => pool.ping(),
  closePool: async (pool) => pool.close(),
};
