const path = require('node:path');

const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3007),
  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_requests'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('localhost'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  REQUEST_QUEUE: z.string().default('request_events'),
  REQUEST_INDEX: z.string().default('uajs_requests'),
  REQUEST_CACHE_TTL: z.coerce.number().int().positive().default(3600),
  // Cola COMPARTIDA que escucha notification-service (nunca REQUEST_QUEUE:
  // ver AGENTS.md, "Notificaciones in-app").
  NOTIFICATION_QUEUE: z.string().default('notification_events'),
  SERVICE_AUTH_TOKEN: z.string().min(32, 'SERVICE_AUTH_TOKEN debe tener al menos 32 caracteres'),
  // Llamada inter-servicio: valida que un archivo adjunto existe de verdad
  // antes de vincularlo a una solicitud.
  SERVICE_STORAGE_URL: z.string().url(),
});

module.exports = { env: EnvSchema.parse(process.env) };
