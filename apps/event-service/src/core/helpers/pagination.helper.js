/**
 * Genera el objeto meta de paginación estandarizado.
 * @param {number} page - Página actual.
 * @param {number} limit - Límite de elementos por página.
 * @param {number} total - Total de elementos.
 * @returns {{page: number, limit: number, total: number, totalPages: number}}
 */
const getPaginationMeta = (page, limit, total) => ({
  page: parseInt(page, 10),
  limit: parseInt(limit, 10),
  total,
  totalPages: Math.ceil(total / limit),
});

module.exports = { getPaginationMeta };
