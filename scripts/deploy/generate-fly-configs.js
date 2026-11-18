const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve(__dirname, '../../infrastructure/fly');
fs.mkdirSync(dir, { recursive: true });

const services = [
  ['auth-service', 3001, '/healthz', {}],
  [
    'user-service',
    3002,
    '/api/v1/users/health',
    {
      SERVICE_UNIVERSITY_URL: 'http://uajs-smartcampus-university-service.internal:3004',
    },
  ],
  ['catalog-service', 3003, '/api/v1/catalog/health', {}],
  ['university-service', 3004, '/api/v1/university/health', {}],
  ['resource-service', 3005, '/api/v1/resources/health', {}],
  [
    'booking-service',
    3006,
    '/api/v1/bookings/health',
    {
      SERVICE_RESOURCE_URL: 'http://uajs-smartcampus-resource-service.internal:3005',
    },
  ],
  [
    'request-service',
    3007,
    '/api/v1/requests/health',
    {
      SERVICE_STORAGE_URL: 'http://uajs-smartcampus-storage-service.internal:3011',
    },
  ],
  ['event-service', 3008, '/api/v1/events/health', {}],
  ['notification-service', 3009, '/api/v1/notifications/health', {}],
  [
    'pqrs-service',
    3010,
    '/api/v1/pqrs/health',
    {
      SERVICE_STORAGE_URL: 'http://uajs-smartcampus-storage-service.internal:3011',
    },
  ],
  [
    'storage-service',
    3011,
    '/api/v1/storage/health',
    {
      STORAGE_PATH: '/uploads',
    },
  ],
];

for (const [name, port, healthPath, extraEnv] of services) {
  const extraEnvLines = Object.entries(extraEnv)
    .map(([key, value]) => `  ${key} = "${value}"`)
    .join('\n');

  const envBlock = extraEnvLines ? `\n${extraEnvLines}` : '';

  const content = `# Configuración de Fly.io para ${name}
app = "uajs-smartcampus-${name}"
primary_region = "gru"

[build]
  dockerfile = "../../Dockerfile"

  [build.args]
    SERVICE_NAME = "${name}"
    PORT = "${port}"
    HEALTH_PATH = "${healthPath}"

[env]
  NODE_ENV = "production"
  PORT = "${port}"${envBlock}

[http_service]
  internal_port = ${port}
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "15s"
    method = "GET"
    path = "${healthPath}"

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
`;
  fs.writeFileSync(path.join(dir, `fly.${name}.toml`), content, 'utf8');
}

console.log(`Generados ${services.length} archivos en infrastructure/fly/`);
