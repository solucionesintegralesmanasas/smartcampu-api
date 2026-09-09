const LogEntrySchema = {
  '@timestamp': 'string (ISO8601)',
  service: 'string',
  level: 'error|warn|info|debug|http',
  message: 'string',
  correlationId: 'string (UUID)',
  requestId: 'string (UUID)',
  userId: 'string',
  http: {
    method: 'string',
    path: 'string',
    statusCode: 'number',
    duration: 'number',
  },
  error: {
    name: 'string',
    message: 'string',
    stack: 'string',
    code: 'string',
  },
  metadata: 'object',
};

const ElasticsearchIndexConfig = {
  settings: {
    number_of_shards: 'number',
    number_of_replicas: 'number',
    'index.lifecycle.name': 'string',
  },
  mappings: { dynamic: 'strict|true|false', properties: 'object' },
};

module.exports = { LogEntrySchema, ElasticsearchIndexConfig };
