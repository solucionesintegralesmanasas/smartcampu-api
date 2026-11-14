const path = require('node:path');

// eslint-disable-next-line import/no-extraneous-dependencies
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3006),
  JWT_SECRET: z.string().min(64, 'JWT_SECRET debe tener al menos 64 caracteres'),
  MYSQL_HOST: z.string().default('mysql'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_bookings'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('elasticsearch'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  SERVICE_AUTH_TOKEN: z.string().min(32, 'SERVICE_AUTH_TOKEN debe tener al menos 32 caracteres'),
  SERVICE_RESOURCE_URL: z.string().url().default('http://resource-service:3005'),
  RESOURCE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

module.exports = { env: EnvSchema.parse(process.env) };
