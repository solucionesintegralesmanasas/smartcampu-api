/**
 * Normaliza y calcula los parámetros de paginación seguros.
 * @param {number|string} page - Número de página actual
 * @param {number|string} limit - Cantidad de registros por página
 * @returns {{ page: number, limit: number, offset: number }}
 */
const paginationHelper = (page = 1, limit = 20) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, offset };
};

/**
 * Empaqueta un resultado con metadatos de paginación estándar.
 * @param {Array} rows - Lista de registros
 * @param {number} total - Total de registros disponibles
 * @param {number} page - Página actual
 * @param {number} limit - Límite por página
 * @returns {{ data: Array, pagination: object }}
 */
const paginateResult = (rows, total, page, limit) => ({
  data: rows,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
});

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

module.exports = {
  paginationHelper,
  paginateResult,
  getPaginationMeta,
};
