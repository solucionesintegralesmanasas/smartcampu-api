const path = require('node:path');

const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const FORMATO_FESTIVO = /^\d{4}-\d{2}-\d{2}$/;

const HolidaysSchema = z
  .string()
  .default('')
  .refine(
    (valor) => valor
      .split(',')
      .map((fecha) => fecha.trim())
      .filter(Boolean)
      .every((fecha) => FORMATO_FESTIVO.test(fecha)),
    { message: 'HOLIDAYS debe contener fechas YYYY-MM-DD separadas por coma' },
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3010),
  JWT_SECRET: z.string().min(64, 'JWT_SECRET debe tener al menos 64 caracteres'),
  MYSQL_HOST: z.string().default('mysql'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_pqrs'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('elasticsearch'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  PQRS_INDEX: z.string().default('uajs_pqrs'),
  HOLIDAYS: HolidaysSchema,
});

module.exports = { env: EnvSchema.parse(process.env) };
