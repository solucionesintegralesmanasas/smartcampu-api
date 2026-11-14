/**
 * Normaliza y calcula los parámetros de paginación seguros.
 * @param {number|string} page - Número de página actual.
 * @param {number|string} limit - Cantidad de registros por página (máx. 100).
 * @returns {{ page: number, limit: number, offset: number }}
 */
const paginationHelper = (page = 1, limit = 20) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, offset };
};

/**
 * Genera metadatos de paginación.
 * @param {number} page
 * @param {number} limit
 * @param {number} total
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
const getPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

module.exports = { paginationHelper, getPaginationMeta };
