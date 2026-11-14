/**
 * Genera el objeto `meta` estandarizado de paginación.
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

module.exports = { getPaginationMeta };
