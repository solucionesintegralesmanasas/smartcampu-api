/**
 * Genera un objeto de paginación estandarizado.
 * @param {number} page - Página actual.
 * @param {number} limit - Límite de elementos por página.
 * @param {number} total - Total de elementos.
 * @returns {object} Objeto de metadatos de paginación.
 */
const getPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

module.exports = { getPaginationMeta };
