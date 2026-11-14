/**
 * Ejecuta un callback dentro de una transacción MySQL.
 * Hace commit si el callback termina bien y rollback si lanza un error.
 * @param {import('mysql2/promise').Pool} pool - Pool de conexiones.
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<any>} callback
 * @returns {Promise<any>} Resultado del callback.
 */
const runInTransaction = async (pool, callback) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

module.exports = { runInTransaction };
