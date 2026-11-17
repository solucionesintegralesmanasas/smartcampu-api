/* eslint-disable no-await-in-loop */
const mysql = require('mysql2/promise');

const { env } = require('../env');
const logger = require('../logger');

let pool = null;

/**
 * Obtiene el pool de conexiones MySQL (creación perezosa).
 * Las fechas se manejan en UTC (timezone 'Z').
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
      charset: 'utf8mb4',
      timezone: 'Z',
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
};

/**
 * Verifica la conexión a MySQL con reintentos.
 * @param {number} intentos - Número máximo de intentos.
 * @param {number} esperaMs - Espera entre intentos en milisegundos.
 */
const verifyMysqlConnection = async (intentos = 5, esperaMs = 5000) => {
  const mysqlPool = getMysqlPool();
  for (let intento = 1; intento <= intentos; intento += 1) {
    try {
      const conn = await mysqlPool.getConnection();
      conn.release();
      logger.info('Conexión a MySQL establecida correctamente');
      return;
    } catch (error) {
      logger.warn('Error de conexión a MySQL', {
        intento,
        intentosMaximos: intentos,
        error: error.message,
      });
      if (intento < intentos) {
        await new Promise((res) => setTimeout(res, esperaMs));
      }
    }
  }
  throw new Error('No se pudo conectar a la base de datos MySQL después de múltiples intentos');
};

/**
 * Cierra el pool de conexiones MySQL si fue creado.
 */
const closeMysqlPool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

module.exports = { getMysqlPool, verifyMysqlConnection, closeMysqlPool };
