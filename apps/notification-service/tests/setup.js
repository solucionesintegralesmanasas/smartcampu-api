const testEnv = {
  NODE_ENV: 'test',
  PORT: '3009',
  JWT_SECRET: 'test_secret_key_min_64_characters_long_for_jwt_security_purposes_here',
  MYSQL_HOST: 'localhost',
  MYSQL_PORT: '3306',
  MYSQL_USER: 'test_user',
  MYSQL_PASSWORD: 'test_password',
  MYSQL_DATABASE: 'uajs_notifications_test',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  ELASTICSEARCH_HOST: 'localhost',
  ELASTICSEARCH_PORT: '9200',
  NOTIFICATION_DELIVERY_QUEUE: 'test.uajs.notificaciones.entregas.v1',
  NOTIFICATION_WORKER_CONCURRENCY: '2',
  NOTIFICATION_CHANNEL_DRIVER: 'log',
  NOTIFICATION_IDEMPOTENCY_TTL: '3600',
  NOTIFICATION_EVENTS_INDEX: 'test_uajs_notifications_events',
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

jest.mock('../src/config/elasticsearch', () => ({
  esClient: { client: { index: jest.fn().mockResolvedValue({}) } },
  ensureNotificationsEventsIndex: jest.fn().mockResolvedValue(undefined),
  indexAuditEvent: jest.fn().mockResolvedValue(undefined),
}));
