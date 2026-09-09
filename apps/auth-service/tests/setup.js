const testEnv = {
  NODE_ENV: 'test',
  PORT: '3001',
  JWT_SECRET: 'test_secret_key_min_64_characters_long_for_jwt_security_purposes_here',
  JWT_REFRESH_SECRET: '',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: '10',
  MYSQL_HOST: 'localhost',
  MYSQL_PORT: '3306',
  MYSQL_USER: 'test',
  MYSQL_PASSWORD: 'test',
  MYSQL_DATABASE: 'test_db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  ELASTICSEARCH_HOST: 'localhost',
  ELASTICSEARCH_PORT: '9200',
  ELASTICSEARCH_USER: 'elastic',
  ELASTICSEARCH_PASSWORD: 'changeme',
  EMAIL_QUEUE: 'test_auth_emails',
  AUTH_EVENTS_INDEX: 'test_uajs_auth_events',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
};

Object.entries(testEnv).forEach(([key, value]) => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
});
