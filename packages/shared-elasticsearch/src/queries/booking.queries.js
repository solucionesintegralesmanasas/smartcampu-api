const { BOOKING_INDEX } = require('../client');

const searchBookings = async (
  client,
  {
    usuarioId, recursoId, fechaInicio, fechaFin, estado, tipo, page = 1, size = 20,
  },
) => {
  const filter = [];

  if (usuarioId) filter.push({ term: { id_usuario: usuarioId } });
  if (recursoId) filter.push({ term: { id_recurso: recursoId } });
  if (estado) filter.push({ term: { estado } });
  if (tipo) filter.push({ term: { tipo } });
  if (fechaInicio || fechaFin) {
    const range = {};
    if (fechaInicio) range.gte = fechaInicio;
    if (fechaFin) range.lte = fechaFin;
    filter.push({ range: { fecha_reserva: range } });
  }

  const result = await client.search({
    index: BOOKING_INDEX,
    body: {
      query: {
        bool: {
          must: [{ match_all: {} }],
          filter,
        },
      },
      sort: [{ fecha_reserva: { order: 'desc' } }, { hora_inicio: { order: 'asc' } }],
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

const getBookingByUuid = async (client, uuid) => {
  try {
    const result = await client.get({ index: BOOKING_INDEX, id: uuid });
    return result;
  } catch (error) {
    if (error.meta?.statusCode === 404) return null;
    throw error;
  }
};

const getBookingsByUser = async (client, usuarioId, { page = 1, size = 20 } = {}) => {
  const result = await client.search({
    index: BOOKING_INDEX,
    body: {
      query: { term: { id_usuario: usuarioId } },
      sort: [{ fecha_reserva: { order: 'desc' } }],
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

const getBookingsByResource = async (
  client,
  recursoId,
  {
    fechaInicio, fechaFin, page = 1, size = 20,
  } = {},
) => {
  const filter = [{ term: { id_recurso: recursoId } }];
  if (fechaInicio || fechaFin) {
    const range = {};
    if (fechaInicio) range.gte = fechaInicio;
    if (fechaFin) range.lte = fechaFin;
    filter.push({ range: { fecha_reserva: range } });
  }

  const result = await client.search({
    index: BOOKING_INDEX,
    body: {
      query: { bool: { filter } },
      sort: [{ fecha_reserva: { order: 'asc' } }, { hora_inicio: { order: 'asc' } }],
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

module.exports = {
  searchBookings,
  getBookingByUuid,
  getBookingsByUser,
  getBookingsByResource,
};
