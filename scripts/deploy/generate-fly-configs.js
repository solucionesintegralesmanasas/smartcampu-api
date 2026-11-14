const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../../infrastructure/fly');
fs.mkdirSync(dir, { recursive: true });

const services = [
  ['auth-service', 3001],
  ['user-service', 3002],
  ['catalog-service', 3003],
  ['university-service', 3004],
  ['resource-service', 3005],
  ['booking-service', 3006],
  ['request-service', 3007],
  ['event-service', 3008],
  ['notification-service', 3009],
  ['pqrs-service', 3010],
  ['storage-service', 3011],
];

for (const [name, port] of services) {
  const content = `# Configuración de Fly.io para ${name}
app = "uajs-smartcampus-${name}"
primary_region = "bog"

[build]
  dockerfile = "../../Dockerfile"

  [build.args]
    SERVICE_NAME = "${name}"
    PORT = "${port}"
    HEALTH_PATH = "/healthz"

[env]
  NODE_ENV = "production"
  PORT = "${port}"

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
    path = "/healthz"

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
`;
  fs.writeFileSync(path.join(dir, `fly.${name}.toml`), content, 'utf8');
}

console.log(`Generados ${services.length} archivos en infrastructure/fly/`);
