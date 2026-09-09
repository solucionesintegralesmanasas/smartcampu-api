# Elasticsearch — UAJS Smart Campus

Configuración de Elasticsearch 8.x y Kibana para desarrollo local.

## Requisitos

- Docker Engine 20.10+
- Docker Compose 2.0+
- Mínimo 2GB de RAM disponible para Elasticsearch

## Inicio rápido

```bash
cd infrastructure/elasticsearch
docker-compose up -d
```

## Verificar

```bash
# Estado del clúster
curl -u elastic:changeme http://localhost:9200/_cluster/health?pretty

# Índices existentes
curl -u elastic:changeme http://localhost:9200/_cat/indices?v

# Kibana
# Abrir http://localhost:5601 en el navegador
# Usuario: elastic / Contraseña: changeme
```

## Credenciales por defecto

| Campo         | Valor      |
| ------------- | ---------- |
| Usuario       | `elastic`  |
| Contraseña    | `changeme` |
| Puerto ES     | 9200       |
| Puerto Kibana | 5601       |

> **IMPORTANTE:** Cambiar la contraseña en producción.

## Configuración de desarrollo

El `docker-compose.yml` está configurado para desarrollo local:

- **single-node**: Un solo nodo (sin clúster distribuido)
- **xpack.security**: Habilitado pero con contraseña por defecto
- **SSL deshabilitado**: Para facilitar el desarrollo
- **1GB RAM**: Límite de memoria para el contenedor

## Integración con el monorepo

### Variables de entorno

```env
ELASTICSEARCH_HOST=elasticsearch
ELASTICSEARCH_PORT=9200
ELASTICSEARCH_USER=elastic
ELASTICSEARCH_PASSWORD=changeme
```

### Conexión desde servicios

```javascript
const { createElasticsearchClient } = require('@uajs/shared-elasticsearch');

const client = createElasticsearchClient({
  host: process.env.ELASTICSEARCH_HOST,
  port: process.env.ELASTICSEARCH_PORT,
  user: process.env.ELASTICSEARCH_USER,
  password: process.env.ELASTICSEARCH_PASSWORD,
});
```

## Crear índices

```bash
# Ejecutar script de setup
node scripts/elasticsearch/setup.js

# O crear índices manualmente
curl -u elastic:changeme -X PUT "http://localhost:9200/uajs_users" -H 'Content-Type: application/json' -d '{
  "settings": { "number_of_shards": 1, "number_of_replicas": 1 },
  "mappings": {
    "properties": {
      "id": { "type": "integer" },
      "uuid": { "type": "keyword" },
      "correo": { "type": "keyword" },
      "estado": { "type": "keyword" },
      "roles": { "type": "keyword" }
    }
  }
}'
```

## Troubleshooting

### ES no inicia (out of memory)

- Aumentar la RAM disponible para Docker Desktop a 4GB+
- Reducir `ES_JAVA_OPTS` a `-Xms512m -Xmx512m`

### ES tarda en iniciar

- Esperar 30-60 segundos después del healthcheck
- Verificar logs: `docker logs uajs-elasticsearch`

### Kibana no conecta

- Verificar que ES esté healthy: `docker ps`
- Verificar credenciales en Kibana

### Permisos de volumen

```bash
sudo chown -R 1000:1000 es-data/
```

## Producción

Para producción, se recomienda:

- Habilitar SSL/TLS
- Usar clúster multi-nodo
- Configurar roles de seguridad
- Usar contraseñas seguras
- Configurar backups con Snapshot/Restore
