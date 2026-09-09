// Defaults de variables de entorno para los tests del API Gateway.
// Se cargan en `setupFiles` de Jest, antes de que se importe config/env.

const testEnv = {
  PORT: '3000',
  NODE_ENV: 'test',
  JWT_SECRET: 'test_secret_key_min_32_characters_long_for_jest',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  RATE_LIMIT_BUCKET_CAPACITY: '100',
  RATE_LIMIT_REFILL_PER_SEC: '10',
  SERVICE_AUTH_URL: 'http://auth-service:3001',
  SERVICE_USER_URL: 'http://user-service:3002',
  SERVICE_CATALOG_URL: 'http://catalog-service:3003',
  SERVICE_UNIVERSITY_URL: 'http://university-service:3004',
  SERVICE_RESOURCE_URL: 'http://resource-service:3005',
  SERVICE_BOOKING_URL: 'http://booking-service:3006',
  SERVICE_REQUEST_URL: 'http://request-service:3007',
  SERVICE_EVENT_URL: 'http://event-service:3008',
  SERVICE_NOTIFICATION_URL: 'http://notification-service:3009',
  SERVICE_PQRS_URL: 'http://pqrs-service:3010',
  SERVICE_STORAGE_URL: 'http://storage-service:3011',
};

// Solo aplica defaults si la variable no está ya definida en el proceso real.
Object.entries(testEnv).forEach(([key, value]) => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
});
