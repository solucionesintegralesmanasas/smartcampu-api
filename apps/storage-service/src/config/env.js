const path = require('node:path');

// eslint-disable-next-line import/no-extraneous-dependencies
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3011),
  JWT_SECRET: z.string().min(64, 'JWT_SECRET debe tener al menos 64 caracteres').optional(),
  MYSQL_HOST: z.string().default('mysql'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_storage'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('elasticsearch'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  STORAGE_QUEUE: z.string().default('storage_jobs'),
  STORAGE_INDEX: z.string().default('uajs_storage'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(10485760),
  UPLOAD_DIR: z.string().default('/uploads'),
});

module.exports = { env: EnvSchema.parse(process.env) };
