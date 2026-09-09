#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// eslint-disable-next-line import/no-extraneous-dependencies
const dotenv = require('dotenv');
// eslint-disable-next-line import/no-extraneous-dependencies
const { z } = require('zod');

const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database (MySQL)
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  MYSQL_DATABASE: z.string().min(1),
  DB_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Redis
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),

  // JWT
  // Se soportan dos esquemas: legacy (JWT_SECRET) y doble-clave
  // (JWT_ACCESS_SECRET + JWT_REFRESH_SECRET). Al menos uno debe existir.
  JWT_SECRET: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  // Service authentication
  SERVICE_AUTH_TOKEN: z.string().min(32),

  // Gateway
  CORS_ALLOWED_ORIGINS: z.string().default('*'),
  RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // Elasticsearch
  ELASTICSEARCH_HOST: z.string().min(1),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  ELASTICSEARCH_USER: z.string().min(1).default('elastic'),
  ELASTICSEARCH_PASSWORD: z.string().min(8),

  // Optional extras (no rompen la validación si faltan)
  LOG_LEVEL: z.string().default('info'),
  SERVICE_NAME: z.string().default('uajs-smart-campus'),
});

const VARIABLES_CLAVE = [
  'MYSQL_HOST',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'REDIS_HOST',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SERVICE_AUTH_TOKEN',
  'ELASTICSEARCH_HOST',
  'ELASTICSEARCH_PASSWORD',
];

const ROOT = path.resolve(__dirname, '..');
// Se validan: plantilla canónica + entornos (si existen)
const files = ['.env.example', '.env.development', '.env.staging', '.env.production'];

let allValid = true;

files.forEach((file) => {
  const filePath = path.join(ROOT, file);

  if (!fs.existsSync(filePath)) {
    console.log(`  ${file}: no existe, se omite`);
    return;
  }

  const env = dotenv.config({ path: filePath }).parsed || {};
  try {
    const parsed = envSchema.parse(env);

    // Coherencia JWT: debe haber JWT_SECRET (legacy) o bien
    // el par JWT_ACCESS_SECRET + JWT_REFRESH_SECRET (ambos >= 32 chars).
    const tieneDoble = parsed.JWT_ACCESS_SECRET && parsed.JWT_REFRESH_SECRET;
    const calculados = {
      JWT_SECRET: parsed.JWT_SECRET?.trim().length || 0,
      JWT_ACCESS_SECRET: parsed.JWT_ACCESS_SECRET?.trim().length || 0,
      JWT_REFRESH_SECRET: parsed.JWT_REFRESH_SECRET?.trim().length || 0,
    };

    const errores = [];
    if (tieneDoble) {
      ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']
        .filter((k) => calculados[k] < 32)
        .forEach((k) => {
          errores.push(`${k}: debe tener al menos 32 caracteres`);
        });
    } else if (calculados.JWT_SECRET >= 32) {
      // Legacy válido
    } else {
      errores.push(
        'JWT: define JWT_SECRET (>=32 chars) o el par JWT_ACCESS_SECRET y JWT_REFRESH_SECRET (>=32 chars c/u)',
      );
    }

    if (errores.length > 0) {
      const validationError = new Error('Validación JWT fallida');
      validationError.issues = errores.map((message) => ({ path: ['JWT'], message }));
      throw validationError;
    }

    console.log(`  ${file} es valido`);
  } catch (error) {
    console.error(`  Error en ${file}:`);
    (error.issues || error.errors || []).forEach((e) => {
      const pathStr = Array.isArray(e.path) ? e.path.join('.') : e.path || '';
      console.error(`    - ${pathStr ? `${pathStr}: ` : ''}${e.message}`);
    });
    allValid = false;
  }

  // Advertencia: si la plantilla omite alguna variable clave que el esquema exige
  if (file === '.env.example') {
    const presentes = Object.keys(env);
    const faltantes = VARIABLES_CLAVE.filter((v) => !presentes.includes(v));
    if (faltantes.length > 0) {
      console.warn(`  [aviso] ${file} no define variables clave: ${faltantes.join(', ')}`);
    }
  }
});

if (!allValid) process.exit(1);
console.log('Todos los archivos de entorno son validos');
