module.exports = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      event_type: { type: 'keyword' },
      user_id: { type: 'integer' },
      correo: { type: 'keyword' },
      ip: { type: 'ip' },
      user_agent: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      success: { type: 'boolean' },
      failure_reason: { type: 'text' },
      token_type: { type: 'keyword' },
      request_id: { type: 'keyword' },
      metadata: { type: 'object', enabled: false },
      '@timestamp': { type: 'date' },
    },
  },
};
