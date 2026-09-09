const path = require('node:path');

const dotenv = require('dotenv');
const { z } = require('zod');

// Carga variables de entorno del .env del gateway (si existe)
// sin sobrescribir las ya presentes en el proceso real.
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  CORS_ALLOWED_ORIGINS: z.string().transform((val) => val.split(',').map((s) => s.trim())),

  // Rate Limiting
  RATE_LIMIT_BUCKET_CAPACITY: z.coerce.number().default(100),
  RATE_LIMIT_REFILL_PER_SEC: z.coerce.number().default(10),

  // Microservicios
  SERVICE_AUTH_URL: z.string().url(),
  SERVICE_USER_URL: z.string().url(),
  SERVICE_CATALOG_URL: z.string().url(),
  SERVICE_UNIVERSITY_URL: z.string().url(),
  SERVICE_RESOURCE_URL: z.string().url(),
  SERVICE_BOOKING_URL: z.string().url(),
  SERVICE_REQUEST_URL: z.string().url(),
  SERVICE_EVENT_URL: z.string().url(),
  SERVICE_NOTIFICATION_URL: z.string().url(),
  SERVICE_PQRS_URL: z.string().url(),
  SERVICE_STORAGE_URL: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Error de validación de variables de entorno:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

module.exports = parsed.data;
