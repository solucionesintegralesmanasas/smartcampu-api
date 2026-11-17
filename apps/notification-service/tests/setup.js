jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3009,
    MYSQL_HOST: 'localhost',
    MYSQL_PORT: 3306,
    MYSQL_USER: 'test_user',
    MYSQL_PASSWORD: 'test_password',
    MYSQL_DATABASE: 'test_db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    ELASTICSEARCH_HOST: 'localhost',
    ELASTICSEARCH_PORT: 9200,
    NOTIFICATION_QUEUE: 'test_notification_events',
    NOTIFICATION_INDEX: 'test_notifications',
    NOTIFICATION_CACHE_TTL: 3600,
    SERVICE_AUTH_TOKEN: 'test_service_token_min_32_characters_long',
  },
}));

jest.mock('../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  },
}));
