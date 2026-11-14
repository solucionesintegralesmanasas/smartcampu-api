/**
 * Normaliza los parámetros de paginación y calcula el desplazamiento.
 * @param {number|string} page - Número de página actual.
 * @param {number|string} limit - Elementos por página (máximo 100).
 * @returns {{ page: number, limit: number, offset: number }}
 */
const paginationHelper = (page = 1, limit = 20) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
};

/**
 * Genera el objeto meta de paginación estandarizado.
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

module.exports = { paginationHelper, getPaginationMeta };
