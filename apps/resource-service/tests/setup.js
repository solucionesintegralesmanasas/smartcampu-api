const testEnv = {
  NODE_ENV: 'test',
  PORT: '3005',
  JWT_SECRET: 'test_secret_key_min_64_characters_long_for_jwt_security_purposes_here',
  SERVICE_AUTH_TOKEN: 'test_service_token_minimo_32_caracteres_seguro',
  MYSQL_HOST: 'localhost',
  MYSQL_PORT: '3306',
  MYSQL_USER: 'test',
  MYSQL_PASSWORD: 'test',
  MYSQL_DATABASE: 'test_resources',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  ELASTICSEARCH_HOST: 'localhost',
  ELASTICSEARCH_PORT: '9200',
  ELASTICSEARCH_USER: 'elastic',
  ELASTICSEARCH_PASSWORD: 'changeme',
  RESOURCE_QUEUE: 'test_resource_events',
};

Object.entries(testEnv).forEach(([key, value]) => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
});
