# Elasticsearch Setup — UAJS Smart Campus v2.1

Guía completa de configuración de Elasticsearch para el monorepo UAJS Smart Campus.

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│                  Kibana (:5601)                  │
│           Dashboard y visualización             │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│            Elasticsearch (:9200)                 │
│     single-node, xpack.security enabled         │
│                                                  │
│  Índices:                                        │
│  ├── uajs_users          (usuarios)              │
│  ├── uajs_logs-*         (logs diarios)          │
│  ├── uajs_events         (eventos)               │
│  ├── uajs_resources      (recursos)              │
│  ├── uajs_bookings       (reservas)              │
│  ├── uajs_catalogs       (catálogos)             │
│  ├── uajs_university     (universidad)           │
│  ├── uajs_requests       (solicitudes)           │
│  ├── uajs_notifications  (notificaciones)        │
│  ├── uajs_pqrs           (pqrs)                  │
│  ├── uajs_storage        (archivos)              │
│  ├── uajs_auth           (logs auth)             │
│  └── uajs_gateway        (logs gateway)          │
└─────────────────────▲───────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────┐
│              @uajs/shared-elasticsearch          │
│         Cliente, mapeos, queries, utils          │
└─────────────────────▲───────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼───┐      ┌─────▼─────┐     ┌─────▼─────┐
│Gateway│      │ Auth Svc  │     │ User Svc  │
│  :3000│      │   :3001   │     │   :3002   │
└───────┘      └───────────┘     └───────────┘
```

## Requisitos previos

- Docker Engine 20.10+
- Docker Compose 2.0+
- Mínimo 2GB RAM disponible para Elasticsearch
- Node.js 20 (para scripts de setup)

## Inicio rápido

### Opción 1: Stack completo (recomendado)

```bash
cd infrastructure/docker
docker compose up -d
```

Esto levanta: MySQL + Redis + Elasticsearch + Kibana + 12 servicios.

### Opción 2: Solo Elasticsearch (desarrollo aislado)

```bash
cd infrastructure/elasticsearch
docker compose up -d
```

Esto levanta: Elasticsearch + Kibana únicamente.

## Configuración

### Variables de entorno

```env
ELASTICSEARCH_HOST=elasticsearch    # hostname del contenedor
ELASTICSEARCH_PORT=9200             # puerto de la API REST
ELASTICSEARCH_USER=elastic          # usuario por defecto
ELASTICSEARCH_PASSWORD=changeme     # contraseña (cambiar en prod)
ELASTICSEARCH_API_VERSION=8.12      # versión de la API
```

### Credenciales por defecto

| Campo            | Valor      |
| ---------------- | ---------- |
| Usuario          | `elastic`  |
| Contraseña       | `changeme` |
| Puerto REST      | 9200       |
| Puerto transport | 9300       |
| Kibana           | 5601       |

## Crear índices

```bash
# Usar el script de setup
node scripts/elasticsearch/setup.js

# Verificar estado
node scripts/elasticsearch/setup.js --status

# Eliminar todos los índices (¡cuidado!)
node scripts/elasticsearch/setup.js --delete
```

### Creación manual

```bash
curl -u elastic:changeme -X PUT "http://localhost:9200/uajs_users" \
  -H 'Content-Type: application/json' -d '{
  "settings": { "number_of_shards": 1, "number_of_replicas": 1 },
  "mappings": {
    "properties": {
      "id": { "type": "integer" },
      "uuid": { "type": "keyword" },
      "correo": { "type": "keyword" },
      "estado": { "type": "keyword" },
      "roles": { "type": "keyword" },
      "createdAt": { "type": "date" }
    }
  }
}'
```

## Uso desde servicios

### Conexión

```javascript
const { createElasticsearchClient } = require('@uajs/shared-elasticsearch');

const client = createElasticsearchClient({
  host: process.env.ELASTICSEARCH_HOST,
  port: process.env.ELASTICSEARCH_PORT,
  user: process.env.ELASTICSEARCH_USER,
  password: process.env.ELASTICSEARCH_PASSWORD,
});
```

### Indexar documento

```javascript
const { utils } = require('@uajs/shared-elasticsearch');

await utils.indexHelper.indexDocument(client, 'uajs_users', userUuid, {
  id: user.id,
  uuid: user.uuid,
  correo: user.correo,
  estado: user.estado,
  roles: ['ESTUDIANTE'],
  createdAt: new Date().toISOString(),
});
```

### Buscar

```javascript
const { queries } = require('@uajs/shared-elasticsearch');

const result = await queries.user.searchUsers(client, {
  query: { match: { correo: 'juan@uajs.edu' } },
  page: 1,
  size: 20,
});
```

### Logging

```javascript
const { utils } = require('@uajs/shared-elasticsearch');

await utils.logger.logToElasticsearch(client, {
  service: 'auth-service',
  level: 'info',
  message: 'Login exitoso',
  requestId: req.requestId,
  userId: user.id,
  metadata: { ip: req.ip },
});
```

## Monitoreo con Kibana

1. Abrir http://localhost:5601
2. Login: `elastic` / `changeme`
3. Ir a **Management > Stack Management > Index Patterns**
4. Crear index pattern: `uajs_logs-*`
5. Ir a **Discover** para ver logs en tiempo real

### Dashboards recomendados

- **Logs por servicio**: Filtrar por `service` field
- **Errores**: Filtrar por `level: error`
- **Tiempos de respuesta**: Usar `metadata.duration` field
- **Autenticación**: Index pattern `uajs_auth-*`

## Troubleshooting

### ES no inicia

```bash
# Verificar logs
docker logs uajs-elasticsearch

# Causa común: memoria insuficiente
# Solución: aumentar RAM en Docker Desktop a 4GB+
```

### ES tarda en estar healthy

- Esperar 30-60 segundos después del primer healthcheck
- Verificar: `curl -u elastic:changeme http://localhost:9200/_cluster/health?pretty`

### Kibana no conecta

```bash
# Verificar que ES esté healthy
docker ps | grep elasticsearch

# Verificar credenciales
curl -u elastic:changeme http://localhost:9200
```

### Permisos de volumen (Linux)

```bash
sudo chown -R 1000:1000 es-data/
```

### Out of Memory

```bash
# Reducir uso de memoria
# Editar docker-compose.yml:
# - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
```

## Producción

Para producción, se recomienda:

1. **Seguridad**:
   - Habilitar SSL/TLS
   - Usar contraseñas seguras (no `changeme`)
   - Configurar roles de seguridad

2. **Disponibilidad**:
   - Clúster multi-nodo (mínimo 3 nodos)
   - Configurar réplicas
   - Backup con Snapshot/Restore

3. **Rendimiento**:
   - Ajustar `number_of_shards` según volumen
   - Usar ILM (Index Lifecycle Management)
   - Monitorear con Metricbeat

4. **Red**:
   - No exponer ES directamente a internet
   - Usar reverse proxy o VPN
   - Configurar firewall
