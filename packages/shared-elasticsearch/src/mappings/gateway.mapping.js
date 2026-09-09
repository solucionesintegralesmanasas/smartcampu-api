module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      method: { type: 'keyword' },
      path: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      status: { type: 'integer' },
      duration: { type: 'integer' },
      ip: { type: 'ip' },
      user_agent: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      user_id: { type: 'integer' },
      request_id: { type: 'keyword' },
      service: { type: 'keyword' },
      level: { type: 'keyword' },
      message: { type: 'text' },
      error: { type: 'text' },
      metadata: { type: 'object', enabled: false },
      '@timestamp': { type: 'date' },
    },
  },
};
