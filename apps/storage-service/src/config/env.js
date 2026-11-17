const path = require('node:path');

const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3011),
  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_storage'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('localhost'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  STORAGE_QUEUE: z.string().default('storage_events'),
  STORAGE_INDEX: z.string().default('uajs_storage'),
  STORAGE_CACHE_TTL: z.coerce.number().int().positive().default(3600),
  // Backend de almacenamiento del contenido binario (ver core/storage/).
  // 'local' guarda en disco bajo STORAGE_PATH; otros drivers (p. ej. s3) se
  // pueden agregar después sin cambiar la capa de servicio/repositorio.
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  STORAGE_PATH: z.string().default('./uploads'),
  STORAGE_MAX_SIZE: z.coerce.number().int().positive().default(10485760),
  // Mismo secreto que el gateway inyecta como X-Service-Token.
  SERVICE_AUTH_TOKEN: z.string().min(32, 'SERVICE_AUTH_TOKEN debe tener al menos 32 caracteres'),
});

module.exports = { env: EnvSchema.parse(process.env) };
