const path = require('node:path');

const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3009),
  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_notifications'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('localhost'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  // Los demás servicios (booking/request/event/pqrs) publican en ESTA MISMA
  // cola sus eventos de dominio notificables (reserva aprobada, PQRS
  // respondida, etc.), con job.name = 'domain_event'. Es la única cola que
  // notification-service escucha para eso — nunca la cola de auditoría
  // propia de cada servicio, porque BullMQ reparte los jobs de una cola
  // entre TODOS los workers que la escuchan (consumidores en competencia,
  // no pub/sub): si notification-service escuchara `booking_events`,
  // competiría con el propio consumidor de auditoría de booking-service y
  // cada evento llegaría a uno u otro al azar, no a ambos.
  NOTIFICATION_QUEUE: z.string().default('notification_events'),
  NOTIFICATION_INDEX: z.string().default('uajs_notifications'),
  NOTIFICATION_CACHE_TTL: z.coerce.number().int().positive().default(3600),
  SERVICE_AUTH_TOKEN: z.string().min(32, 'SERVICE_AUTH_TOKEN debe tener al menos 32 caracteres'),
});

module.exports = { env: EnvSchema.parse(process.env) };
