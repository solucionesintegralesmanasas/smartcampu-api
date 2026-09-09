const { LOG_INDEX } = require('../client');

const searchLogs = async (
  client,
  {
    service, level, message, startDate, endDate, page = 1, size = 50,
  },
) => {
  const must = [];
  const filter = [];

  if (service) {
    filter.push({ term: { service } });
  }
  if (level) {
    filter.push({ term: { level } });
  }
  if (message) {
    must.push({ match: { message } });
  }
  if (startDate || endDate) {
    const range = {};
    if (startDate) range.gte = startDate;
    if (endDate) range.lte = endDate;
    filter.push({ range: { '@timestamp': range } });
  }

  const result = await client.search({
    index: `${LOG_INDEX}-*`,
    body: {
      query: {
        bool: {
          must: must.length ? must : [{ match_all: {} }],
          filter,
        },
      },
      sort: [{ '@timestamp': { order: 'desc' } }],
      from: (page - 1) * size,
      size,
    },
  });
  return result;
};

const getLogsByService = async (
  client,
  serviceName,
  {
    startDate, endDate, level, size = 100,
  } = {},
) => {
  const filter = [{ term: { service: serviceName } }];
  if (level) filter.push({ term: { level } });
  if (startDate || endDate) {
    const range = {};
    if (startDate) range.gte = startDate;
    if (endDate) range.lte = endDate;
    filter.push({ range: { '@timestamp': range } });
  }

  const result = await client.search({
    index: `${LOG_INDEX}-*`,
    body: {
      query: { bool: { filter } },
      sort: [{ '@timestamp': { order: 'desc' } }],
      size,
    },
  });
  return result;
};

const getErrorLogs = async (client, { startDate, endDate, size = 100 } = {}) => {
  const filter = [{ term: { level: 'error' } }];
  if (startDate || endDate) {
    const range = {};
    if (startDate) range.gte = startDate;
    if (endDate) range.lte = endDate;
    filter.push({ range: { '@timestamp': range } });
  }

  const result = await client.search({
    index: `${LOG_INDEX}-*`,
    body: {
      query: { bool: { filter } },
      sort: [{ '@timestamp': { order: 'desc' } }],
      size,
    },
  });
  return result;
};

module.exports = { searchLogs, getLogsByService, getErrorLogs };
