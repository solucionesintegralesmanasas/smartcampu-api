const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../env');

let pool = null;

/**
 * Obtiene o inicializa el pool de conexiones MySQL con circuit breaker.
 * @returns {import('@uajs/database-client').MySQLPool} Pool de conexiones
 */
const getMysqlPool = () => {
  if (!pool) {
    pool = createMysqlPool({
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      connectionLimit: 10,
    });
  }
  return pool;
};

module.exports = {
  getMysqlPool,
  createMySQLPool: getMysqlPool,
};
