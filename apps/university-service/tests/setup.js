const testEnv = {
  NODE_ENV: 'test',
  PORT: '3004',
  MYSQL_HOST: 'localhost',
  MYSQL_PORT: '3306',
  MYSQL_USER: 'test_user',
  MYSQL_PASSWORD: 'test_password',
  MYSQL_DATABASE: 'uajs_academic_test',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  ELASTICSEARCH_HOST: 'localhost',
  ELASTICSEARCH_PORT: '9200',
  UNIVERSITY_QUEUE: 'test_university_events',
  UNIVERSITY_INDEX: 'test_uajs_university',
  UNIVERSITY_CACHE_TTL: '3600',
  CORS_ALLOWED_ORIGINS: '*',
};

Object.entries(testEnv).forEach(([key, value]) => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
});

jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
