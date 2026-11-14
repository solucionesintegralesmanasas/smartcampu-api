const { createMysqlPool } = require('@uajs/database-client');

const { env } = require('../env');

let pool = null;

/**
 * Obtiene o inicializa el pool de conexiones MySQL (base uajs_users).
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

/**
 * Cierra el pool de conexiones si fue inicializado.
 */
const closeMysqlPool = async () => {
  if (pool) {
    await pool.close();
    pool = null;
  }
};

module.exports = { getMysqlPool, closeMysqlPool };
