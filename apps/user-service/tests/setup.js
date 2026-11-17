jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3002,
    MYSQL_HOST: 'localhost',
    MYSQL_PORT: 3306,
    MYSQL_USER: 'test_user',
    MYSQL_PASSWORD: 'test_password',
    MYSQL_DATABASE: 'test_db',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    ELASTICSEARCH_HOST: 'localhost',
    ELASTICSEARCH_PORT: 9200,
    USER_QUEUE: 'test_user_events',
    USER_INDEX: 'test_users',
    USER_CACHE_TTL: 3600,
    SERVICE_AUTH_TOKEN: 'test_service_token_min_32_characters_long',
    SERVICE_UNIVERSITY_URL: undefined,
  },
}));
