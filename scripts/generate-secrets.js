#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const generateSecureToken = (bytes = 32) => crypto
  .randomBytes(bytes)
  .toString('base64')
  .replace(/[+/=]/g, '')
  .substring(0, bytes * 2);

// Secretos de longitudes recomendadas por consumidor:
//  - JWT_* : >= 32 chars (según validación y mejores prácticas)
//  - Otros: 32 bytes -> 64 chars seguros
const secrets = {
  // JWT (gateway + auth)
  JWT_SECRET: generateSecureToken(64),
  JWT_ACCESS_SECRET: generateSecureToken(64),
  JWT_REFRESH_SECRET: generateSecureToken(64),
  // Autenticación entre microservicios
  SERVICE_AUTH_TOKEN: generateSecureToken(64),
  // Infraestructura
  MYSQL_ROOT_PASSWORD: generateSecureToken(32),
  MYSQL_PASSWORD: generateSecureToken(32),
  REDIS_PASSWORD: generateSecureToken(32),
  ELASTICSEARCH_PASSWORD: generateSecureToken(32),
};

// Orden estable y legible
const output = Object.entries(secrets)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n');

const dest = path.join(__dirname, '..', '.env.secrets');
fs.writeFileSync(dest, `${output}\n`);

console.log('Secretos generados en .env.secrets');
console.log('Incluye: JWT_SECRET, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, SERVICE_AUTH_TOKEN,');
console.log('        MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, REDIS_PASSWORD, ELASTICSEARCH_PASSWORD');
console.log('');
console.log('Agrega .env.secrets a tu .gitignore');
console.log('Úsalos en docker-compose vía variables de entorno del host.');
