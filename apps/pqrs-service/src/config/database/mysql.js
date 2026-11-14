const mysql = require('mysql2/promise');

const { env } = require('../env');

let pool = null;

/**
 * Obtiene el pool de conexiones MySQL (creación perezosa).
 * Las columnas TIMESTAMP se manejan en UTC y las DATE llegan como texto YYYY-MM-DD.
 * @returns {import('mysql2/promise').Pool} Pool de conexiones.
 */
const getMysqlPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      connectionLimit: 10,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: 'Z',
      dateStrings: ['DATE'],
    });
  }
  return pool;
};

/**
 * Cierra el pool de conexiones si fue creado.
 */
const closeMysqlPool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

module.exports = { getMysqlPool, closeMysqlPool };
