const path = require('node:path');

const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3009),
  JWT_SECRET: z.string().min(64, 'JWT_SECRET debe tener al menos 64 caracteres'),
  MYSQL_HOST: z.string().default('mysql'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_notifications'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('elasticsearch'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  NOTIFICATION_DELIVERY_QUEUE: z.string().default('uajs.notificaciones.entregas.v1'),
  NOTIFICATION_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
  NOTIFICATION_CHANNEL_DRIVER: z.enum(['log']).default('log'),
  NOTIFICATION_IDEMPOTENCY_TTL: z.coerce.number().int().positive().default(604800),
  NOTIFICATION_EVENTS_INDEX: z.string().default('uajs_notifications_events'),
});

module.exports = { env: EnvSchema.parse(process.env) };
