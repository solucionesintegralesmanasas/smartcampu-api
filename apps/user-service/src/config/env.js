const path = require('node:path');

const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  // Comparte la base de datos de auth-service: users/persons/roles/permissions
  // ya viven ahí y son la fuente de verdad (ver decisión de arquitectura).
  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_auth'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('localhost'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  USER_QUEUE: z.string().default('user_events'),
  USER_INDEX: z.string().default('uajs_users'),
  USER_CACHE_TTL: z.coerce.number().int().positive().default(3600),
  // Mismo secreto que el gateway inyecta como X-Service-Token: sin esto no
  // se puede confiar en X-User-Id/X-User-Roles (ver core/middleware/identity.middleware.js).
  SERVICE_AUTH_TOKEN: z.string().min(32, 'SERVICE_AUTH_TOKEN debe tener al menos 32 caracteres'),
  // Usado por el módulo perfil para enriquecer con datos de estudiante/docente
  // una vez exista university-service (Fase 2). Opcional mientras tanto.
  SERVICE_UNIVERSITY_URL: z.string().url().optional(),
});

module.exports = { env: EnvSchema.parse(process.env) };
