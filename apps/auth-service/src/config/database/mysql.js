/* eslint-disable no-console, no-await-in-loop, no-promise-executor-return */
const mysql = require('mysql2/promise');

const { env } = require('../env');

/**
 * Crea un pool de conexiones MySQL con lógica de reintentos.
 * @returns {Promise<mysql.Pool>} Pool de conexiones de MySQL.
 */
const createMySQLPool = async () => {
  const pool = mysql.createPool({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    connectionLimit: 10,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  let retries = 5;
  while (retries) {
    try {
      await pool.getConnection();
      console.log('✅ Conexión a MySQL establecida correctamente');
      return pool;
    } catch (error) {
      console.error(
        `❌ Error de conexión a MySQL. Reintentos restantes: ${retries}`,
        error.message,
      );
      retries -= 1;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  throw new Error('No se pudo conectar a la base de datos MySQL después de múltiples intentos');
};

module.exports = { createMySQLPool };
