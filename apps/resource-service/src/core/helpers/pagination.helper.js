const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Normaliza los parámetros de paginación (máximo 100 elementos por página).
 * @param {{ page?: number|string, limit?: number|string }} query - Parámetros de consulta.
 * @returns {{ page: number, limit: number, offset: number }}
 */
const parsePagination = ({ page = 1, limit = DEFAULT_LIMIT } = {}) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT));
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
};

/**
 * Genera el objeto de metadatos de paginación.
 * @param {number} page - Página actual.
 * @param {number} limit - Elementos por página.
 * @param {number} total - Total de elementos.
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
const getPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

/**
 * Empaqueta filas con su metadata de paginación.
 * @returns {{ data: Array, meta: object }}
 */
const buildPaginatedResult = (rows, total, page, limit) => ({
  data: rows,
  meta: getPaginationMeta(page, limit, total),
});

module.exports = { parsePagination, getPaginationMeta, buildPaginatedResult };
