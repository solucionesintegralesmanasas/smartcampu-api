const { EVENT_INDEX } = require('../client');

const searchEvents = async (
  client,
  {
    query, tipo, estado, sede, fechaInicio, fechaFin, page = 1, size = 20,
  },
) => {
  const must = [];
  const filter = [];

  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['nombre^3', 'descripcion', 'lugar'],
      },
    });
  }
  if (tipo) filter.push({ term: { tipo } });
  if (estado) filter.push({ term: { estado } });
  if (sede) filter.push({ term: { sede } });
  if (fechaInicio || fechaFin) {
    const range = {};
    if (fechaInicio) range.gte = fechaInicio;
    if (fechaFin) range.lte = fechaFin;
    filter.push({ range: { fecha_evento: range } });
  }

  const result = await client.search({
    index: EVENT_INDEX,
    body: {
      query: {
        bool: {
          must: must.length ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort: [{ fecha_evento: { order: 'asc' } }],
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

const getEventByUuid = async (client, uuid) => {
  try {
    const result = await client.get({ index: EVENT_INDEX, id: uuid });
    return result;
  } catch (error) {
    if (error.meta?.statusCode === 404) return null;
    throw error;
  }
};

const getUpcomingEvents = async (client, { sede, size = 20 } = {}) => {
  const filter = [{ range: { fecha_evento: { gte: 'now' } } }, { term: { estado: 'PROGRAMADO' } }];
  if (sede) filter.push({ term: { sede } });

  const result = await client.search({
    index: EVENT_INDEX,
    body: {
      query: { bool: { filter } },
      sort: [{ fecha_evento: { order: 'asc' } }],
      size,
    },
  });
  return result;
};

module.exports = { searchEvents, getEventByUuid, getUpcomingEvents };
