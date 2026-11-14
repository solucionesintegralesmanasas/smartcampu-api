const { closePool, createMysqlPool } = require('@uajs/database-client');

const { env } = require('../env');

let pool = null;

/**
 * Devuelve el pool de conexiones MySQL de uajs_bookings (se crea una sola vez).
 * @returns {import('@uajs/database-client').MySQLPool} Pool de conexiones.
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

const closeMysqlPool = async () => {
  if (pool) {
    await closePool(pool);
    pool = null;
  }
};

module.exports = { getMysqlPool, closeMysqlPool };
