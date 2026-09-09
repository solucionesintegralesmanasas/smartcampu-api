const { RESOURCE_INDEX } = require('../client');

const searchResources = async (
  client,
  {
    query, tipo, estado, sede, capacidadMin, capacidadMax, page = 1, size = 20,
  },
) => {
  const must = [];
  const filter = [];

  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['nombre^3', 'codigo^2', 'descripcion', 'ubicacion'],
      },
    });
  }
  if (tipo) filter.push({ term: { tipo } });
  if (estado) filter.push({ term: { estado } });
  if (sede) filter.push({ term: { sede } });
  if (capacidadMin || capacidadMax) {
    const range = {};
    if (capacidadMin) range.gte = capacidadMin;
    if (capacidadMax) range.lte = capacidadMax;
    filter.push({ range: { capacidad: range } });
  }

  const result = await client.search({
    index: RESOURCE_INDEX,
    body: {
      query: {
        bool: {
          must: must.length ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort: [{ nombre: { order: 'asc' } }],
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

const getResourceByUuid = async (client, uuid) => {
  try {
    const result = await client.get({ index: RESOURCE_INDEX, id: uuid });
    return result;
  } catch (error) {
    if (error.meta?.statusCode === 404) return null;
    throw error;
  }
};

const getResourcesBySede = async (client, sede, { tipo, page = 1, size = 20 } = {}) => {
  const filter = [{ term: { sede } }];
  if (tipo) filter.push({ term: { tipo } });

  const result = await client.search({
    index: RESOURCE_INDEX,
    body: {
      query: { bool: { filter } },
      sort: [{ nombre: { order: 'asc' } }],
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

module.exports = { searchResources, getResourceByUuid, getResourcesBySede };
