const testEnv = {
  NODE_ENV: 'test',
  PORT: '3002',
  JWT_SECRET: 'test_secret_key_min_64_characters_long_for_jwt_security_purposes_here',
  MYSQL_HOST: 'localhost',
  MYSQL_PORT: '3306',
  MYSQL_USER: 'test',
  MYSQL_PASSWORD: 'test',
  MYSQL_DATABASE: 'test_users_db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  ELASTICSEARCH_HOST: 'localhost',
  ELASTICSEARCH_PORT: '9200',
  ELASTICSEARCH_USER: 'elastic',
  ELASTICSEARCH_PASSWORD: 'changeme',
  USER_INDEX: 'test_uajs_users',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
};

Object.entries(testEnv).forEach(([key, value]) => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
});
