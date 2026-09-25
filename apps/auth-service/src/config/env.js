const path = require('node:path');

// eslint-disable-next-line import/no-extraneous-dependencies
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  JWT_SECRET: z.string().min(64, 'JWT_SECRET debe tener al menos 64 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 64, {
      message: 'JWT_REFRESH_SECRET debe tener al menos 64 caracteres',
    })
    .transform((val) => (val && val.trim().length > 0 ? val : undefined)),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14)
    .default(12),
  MYSQL_HOST: z.string().default('mysql'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_auth'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('elasticsearch'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  EMAIL_QUEUE: z.string().default('auth_emails'),
  AUTH_EVENTS_INDEX: z.string().default('uajs_auth_events'),
});

module.exports = { env: EnvSchema.parse(process.env) };
