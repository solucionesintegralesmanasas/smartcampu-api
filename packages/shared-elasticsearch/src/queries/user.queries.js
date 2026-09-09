const { USER_INDEX } = require('../client');

const searchUsers = async (client, { query, page = 1, size = 20 }) => {
  const result = await client.search({
    index: USER_INDEX,
    body: {
      query,
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

const getUserByUuid = async (client, uuid) => {
  try {
    const result = await client.get({
      index: USER_INDEX,
      id: uuid,
    });
    return result;
  } catch (error) {
    if (error.meta?.statusCode === 404) return null;
    throw error;
  }
};

const searchUsersByRole = async (client, role, { page = 1, size = 20 } = {}) => {
  const result = await client.search({
    index: USER_INDEX,
    body: {
      query: { term: { roles: role } },
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

const searchUsersByStatus = async (client, estado, { page = 1, size = 20 } = {}) => {
  const result = await client.search({
    index: USER_INDEX,
    body: {
      query: { term: { estado } },
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

const autocompleteUsers = async (client, { correo, nombre, size = 10 } = {}) => {
  const should = [];
  if (correo) {
    should.push({ match: { correo: { query: correo, boost: 2 } } });
  }
  if (nombre) {
    should.push({ match: { primer_nombre: { query: nombre, boost: 1 } } });
    should.push({ match: { primer_apellido: { query: nombre, boost: 1 } } });
  }

  const result = await client.search({
    index: USER_INDEX,
    body: {
      query: { bool: { should, minimum_should_match: 1 } },
      size,
    },
  });
  return result;
};

module.exports = {
  searchUsers,
  getUserByUuid,
  searchUsersByRole,
  searchUsersByStatus,
  autocompleteUsers,
};
