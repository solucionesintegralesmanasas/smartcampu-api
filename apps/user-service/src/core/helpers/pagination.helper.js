const MAX_LIMIT = 100;

/**
 * Normaliza los parámetros de paginación (página >= 1, límite entre 1 y 100).
 * @param {number|string} page - Página solicitada.
 * @param {number|string} limit - Registros por página solicitados.
 * @returns {{ page: number, limit: number, offset: number }}
 */
const paginationHelper = (page = 1, limit = 20) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, offset };
};

/**
 * Genera el objeto meta estándar de paginación.
 * @param {number} page - Página actual.
 * @param {number} limit - Registros por página.
 * @param {number} total - Total de registros.
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
const getPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

module.exports = { MAX_LIMIT, paginationHelper, getPaginationMeta };
