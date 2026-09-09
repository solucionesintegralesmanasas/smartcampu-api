# UAJS Smart Campus — 16 Prompts de Generación Enterprise Grade (v2.1)

> **Nivel:** **Enterprise/Architect Grade** — Supera el nivel Senior con patrones de producción avanzados, alta disponibilidad, seguridad robusta y observabilidad completa.
>
> **Total del proyecto:** 295 carpetas + 772 archivos = **1,067 elementos**
>
> **Stack Enterprise:** Node.js 20 + Express 4 + MySQL 8 + Redis (BullMQ) + **Elasticsearch 8.12.x** + Turborepo + Kubernetes ECK
>
> **Enfoque v2.1:** Integración **Enterprise-Grade** con Elasticsearch para logging centralizado, búsqueda avanzada, APM y análisis de datos.
>
> **⚠️ Estado actual del proyecto (realidad):** De los 12 microservicios, solo **api-gateway (3000)**, **auth-service (3001)** y **catalog-service (3003)** tienen implementación de código. Los otros 9 son solo scaffolds sin código (`src/_structure_/`). Las migraciones `scripts/migrations/ms-*_001_init.sql` (8 por-servicio, inglés estándar) definen el esquema objetivo, pero **no hay `migrate.js` funcional** que las aplique, y el código implementado (auth/catalog) aún usa esquemas propios (p. ej. `sedes`, `ciudades`, `users`). Los prompts siguientes representan la arquitectura objetivo; verifíquese contra el estado real antes de aplicar.

---

## 🎯 **Diferencias: Senior vs Enterprise Grade**

| Aspecto           | Nivel Senior         | **Nivel Enterprise Grade**                                         |
| ----------------- | -------------------- | ------------------------------------------------------------------ |
| **Conexión ES**   | Cliente básico       | Pool de conexiones, Circuit Breaker, Retry con backoff exponencial |
| **Seguridad**     | Credenciales básicas | TLS mutuo, API Keys, RBAC, IP Filtering                            |
| **Mapeos**        | Mapeos estáticos     | Dynamic Mappings, Index Templates, ILM Policies                    |
| **Logging**       | Logs simples         | Structured Logging, Log Enrichment, Correlation IDs                |
| **Indexado**      | Indexación síncrona  | Bulk Processing, Async Queue, Conflict Resolution                  |
| **Búsqueda**      | Consultas básicas    | Paginación profunda, Aggregations, Search Templates                |
| **Monitoring**    | Health check básico  | Métricas Prometheus, Alertas, SLOs                                 |
| **Resiliencia**   | Retry simple         | Circuit Breaker, Bulkhead, Timeout, Fallback                       |
| **Escalabilidad** | Single node          | Multi-node, Sharding, Replicas, Cross-Cluster                      |
| **Configuración** | Hardcoded            | Environment-based, Secrets Management, ConfigMaps                  |

---

## 📚 **Preámbulo Técnico Enterprise (Aplicable a Todos los Prompts)**

### 🔹 **Patrones de Resiliencia (Circuit Breaker + Retry)**

```javascript
// packages/shared-elasticsearch/src/client.js
const { Client } = require('@elastic/elasticsearch');
const { CircuitBreaker } = require('opossum');

const createResilientElasticsearchClient = ({
  host = 'elasticsearch',
  port = '9200',
  user = 'elastic',
  password = 'changeme',
  apiVersion = '8.12',
  maxRetries = 5,
  requestTimeout = 30000,
  circuitBreakerThreshold = 0.5, // 50% failures
  circuitBreakerResetTimeout = 30000, // 30s
} = {}) => {
  const client = new Client({
    node: `https://${host}:${port}`,
    auth: { username: user, password },
    apiVersion,
    maxRetries,
    requestTimeout,
    sniffOnStart: true,
    // TLS Configuration
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      ca: process.env.ELASTICSEARCH_CA_CERT
        ? Buffer.from(process.env.ELASTICSEARCH_CA_CERT, 'base64')
        : undefined,
    },
  });

  // Circuit Breaker para operaciones críticas
  const breaker = new CircuitBreaker(
    async (fn, ...args) => {
      return await fn(...args);
    },
    {
      timeout: requestTimeout,
      errorThresholdPercentage: circuitBreakerThreshold,
      resetTimeout: circuitBreakerResetTimeout,
    },
  );

  // Wrapper resiliente
  const resilientRequest = async (method, params, options = {}) => {
    const operation = () =>
      client[method](params, {
        ...options,
        ignore: [404], // No abrir circuito para 404
      });

    try {
      return await breaker.fire(operation);
    } catch (error) {
      // Fallback: si el circuito está abierto, intentar conexión directa
      if (breaker.state === 'OPEN') {
        return await operation();
      }
      throw error;
    }
  };

  return {
    client,
    breaker,
    resilientRequest,
    // Métodos convenientes
    search: (params) => resilientRequest('search', params),
    index: (params) => resilientRequest('index', params),
    get: (params) => resilientRequest('get', params),
    update: (params) => resilientRequest('update', params),
    delete: (params) => resilientRequest('delete', params),
    bulk: (params) => resilientRequest('bulk', params),
    // Health check
    ping: async () => {
      try {
        await resilientRequest('info');
        return { healthy: true, status: 'up' };
      } catch (error) {
        return { healthy: false, status: 'down', error: error.message };
      }
    },
  };
};

module.exports = { createResilientElasticsearchClient };
```

### 🔹 **Configuración de Seguridad Enterprise**

```yaml
# infrastructure/elasticsearch/config/elasticsearch.yml (Producción)
xpack.security.enabled: true
xpack.security.transport.ssl.enabled: true
xpack.security.transport.ssl.verification_mode: certificate
xpack.security.http.ssl.enabled: true
xpack.security.http.ssl.verification_mode: certificate

# RBAC Configuration
xpack.security.authc.api_key.enabled: true
xpack.security.authc.token.enabled: true

# Network Security
network.host: 0.0.0.0
transport.port: 9300
http.port: 9200

# IP Filtering (para producción)
network.bind_host: [_local_, _site_]
network.publish_host: _site_

# TLS Certificates
path.conf: /usr/share/elasticsearch/config
xpack.security.http.ssl.certificate: certs/elasticsearch.crt
xpack.security.http.ssl.key: certs/elasticsearch.key
xpack.security.transport.ssl.certificate: certs/elasticsearch.crt
xpack.security.transport.ssl.key: certs/elasticsearch.key
```

### 🔹 **Index Lifecycle Management (ILM)**

```javascript
// packages/shared-elasticsearch/src/ilm/index.js
const createIndexWithILM = async (client, indexName, mapping, ilmPolicy = 'uajs_default_policy') => {
  // Crear política ILM si no existe
  const policyExists = await client.ilm.getLifecycle({ name: ilmPolicy }).catch(() => false);

  if (!policyExists) {
    await client.ilm.putLifecycle({
      name: ilmPolicy,
      body: {
        policy: {
          phases: {
            hot: {
              min_age: '0ms',
              actions: {
                rollover: {
                  max_size: '50GB',
                  max_age: '30d'
                },
                set_priority: {
                  priority: 100
                }
              }
            },
            warm: {
              min_age: '30d',
              actions: {
                forcemerge: {
                  max_num_segments: 1
                },
                set_priority: {
                  priority: 50
                }
              }
            },
            delete: {
              min_age: '90d',
              actions: {
                delete: {}
              }
            }
          }
        }
      }
    });
  }

  // Crear índice con política ILM
  await client.indices.create({
    index: indexName,
    body: {
      settings: {
        index.lifecycle.name: ilmPolicy,
        index.lifecycle.rollover_alias: indexName,
        index.number_of_shards: 3,
        index.number_of_replicas: 1,
        index.refresh_interval: '30s',
        index.max_result_window: 100000
      },
      mappings: mapping
    }
  });

  // Crear alias
  await client.indices.putAlias({
    index: indexName,
    name: indexName
  });
};

module.exports = { createIndexWithILM };
```

### 🔹 **Structured Logging con Correlation IDs**

```javascript
// packages/shared-elasticsearch/src/utils/logger.js
const { v4: uuidv4 } = require('uuid');

class ElasticsearchLogger {
  constructor(
    client,
    {
      serviceName = 'unknown',
      indexPrefix = 'uajs_logs',
      flushInterval = 5000,
      batchSize = 100,
    } = {},
  ) {
    this.client = client;
    this.serviceName = serviceName;
    this.indexPrefix = indexPrefix;
    this.queue = [];
    this.flushInterval = flushInterval;
    this.batchSize = batchSize;
    this.flushTimeout = null;

    this.startFlusher();
  }

  startFlusher() {
    this.flushTimeout = setInterval(() => {
      if (this.queue.length >= this.batchSize) {
        this.flush();
      }
    }, this.flushInterval);
  }

  stopFlusher() {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
    }
    this.flush();
  }

  async flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);
    const bulkBody = batch.flatMap((log) => [
      { index: { _index: `${this.indexPrefix}-${log.timestamp.split('T')[0]}` } },
      log,
    ]);

    try {
      await this.client.bulk({ body: bulkBody });
    } catch (error) {
      // Fallback: intentar individualmente
      for (const log of batch) {
        try {
          await this.client.index({
            index: `${this.indexPrefix}-${log.timestamp.split('T')[0]}`,
            body: log,
          });
        } catch (e) {
          console.error('Failed to log to ES:', e.message, log);
        }
      }
    }
  }

  log({
    level = 'info',
    message,
    correlationId = uuidv4(),
    requestId,
    userId,
    metadata = {},
    timestamp = new Date().toISOString(),
  }) {
    const logEntry = {
      '@timestamp': timestamp,
      service: this.serviceName,
      level,
      message,
      correlationId,
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...metadata,
    };

    this.queue.push(logEntry);

    // Flush inmediato si el queue está lleno
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }

    return correlationId;
  }

  error(error, { correlationId, requestId, userId, metadata = {} }) {
    const logEntry = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...(error.cause && { cause: error.cause.message }),
      },
      ...metadata,
    };

    return this.log({
      level: 'error',
      message: error.message,
      correlationId,
      requestId,
      userId,
      metadata: logEntry,
    });
  }

  info(message, context = {}) {
    return this.log({ level: 'info', message, ...context });
  }

  warn(message, context = {}) {
    return this.log({ level: 'warn', message, ...context });
  }

  debug(message, context = {}) {
    return this.log({ level: 'debug', message, ...context });
  }

  http({ method, path, statusCode, duration, requestId, userId, correlationId }) {
    return this.log({
      level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
      message: `${method} ${path} ${statusCode}`,
      requestId,
      userId,
      correlationId,
      metadata: {
        http: {
          method,
          path,
          statusCode,
          duration,
        },
      },
    });
  }
}

module.exports = ElasticsearchLogger;
```

### 🔹 **Bulk Processing para Indexado Masivo**

```javascript
// packages/shared-elasticsearch/src/utils/bulkHelper.js
class BulkProcessor {
  constructor(client, { batchSize = 1000, flushInterval = 5000, maxRetries = 3 } = {}) {
    this.client = client;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.maxRetries = maxRetries;
    this.queue = [];
    this.flushTimeout = null;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      retries: 0,
    };
  }

  start() {
    this.flushTimeout = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  stop() {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
    }
    return this.flush();
  }

  add(index, id, document) {
    this.queue.push({ index, id, document });
    this.stats.total++;

    if (this.queue.length >= this.batchSize) {
      this.flush();
    }

    return this.stats;
  }

  addMany(documents, getIndex, getId) {
    const batch = documents.map((doc) => ({
      index: getIndex(doc),
      id: getId(doc),
      document: doc,
    }));

    this.queue.push(...batch);
    this.stats.total += batch.length;

    if (this.queue.length >= this.batchSize) {
      this.flush();
    }

    return this.stats;
  }

  async flush() {
    if (this.queue.length === 0) return this.stats;

    const batch = this.queue.splice(0, this.batchSize);
    const bulkBody = batch.flatMap(({ index, id, document }) => [
      { index: { _index: index, _id: id } },
      document,
    ]);

    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        const response = await this.client.bulk({
          body: bulkBody,
          refresh: false,
        });

        if (response.body.errors) {
          const failed = response.body.items.filter((item) => item.index?.status >= 400);
          this.stats.failed += failed.length;
          this.stats.success += batch.length - failed.length;

          // Reintentar solo los fallidos
          if (retryCount < this.maxRetries - 1) {
            this.queue.unshift(...failed.map((f) => batch[f.index]));
            retryCount++;
            this.stats.retries += failed.length;
            continue;
          }
        } else {
          this.stats.success += batch.length;
        }

        break;
      } catch (error) {
        retryCount++;
        this.stats.retries += batch.length;

        if (retryCount >= this.maxRetries) {
          this.stats.failed += batch.length;
          throw error;
        }

        // Esperar antes de reintentar
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }

    return this.stats;
  }

  async processIterator(iterator, getIndex, getId) {
    for await (const doc of iterator) {
      this.add(getIndex(doc), getId(doc), doc);
    }

    return this.stop();
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      retries: 0,
    };
  }
}

module.exports = BulkProcessor;
```

### 🔹 **Index Templates para Patrones de Índices**

```javascript
// packages/shared-elasticsearch/src/templates/index.js
const createIndexTemplate = async (client, {
  name,
  indexPatterns,
  settings,
  mappings,
  priority = 100
} = {}) => {
  await client.indices.putIndexTemplate({
    name,
    body: {
      index_patterns: indexPatterns,
      template: {
        settings,
        mappings
      },
      priority
    }
  });
};

// Template para logs diarios
const logsTemplate = {
  name: 'uajs_logs_template',
  indexPatterns: ['uajs_logs-*'],
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    index.lifecycle.name: 'uajs_logs_policy',
    index.lifecycle.rollover_alias: 'uajs_logs'
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      '@timestamp': { type: 'date' },
      service: { type: 'keyword' },
      level: { type: 'keyword' },
      message: { type: 'text' },
      correlationId: { type: 'keyword' },
      requestId: { type: 'keyword' },
      userId: { type: 'keyword' },
      http: {
        properties: {
          method: { type: 'keyword' },
          path: { type: 'keyword' },
          statusCode: { type: 'integer' },
          duration: { type: 'integer' }
        }
      },
      error: {
        properties: {
          message: { type: 'text' },
          stack: { type: 'text' },
          name: { type: 'keyword' }
        }
      }
    }
  }
};

// Template para entidades de negocio
const entityTemplate = (entityName) => ({
  name: `uajs_${entityName}_template`,
  indexPatterns: [`uajs_${entityName}_*`],
  settings: {
    number_of_shards: 2,
    number_of_replicas: 1,
    index.lifecycle.name: `uajs_${entityName}_policy`
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      uuid: { type: 'keyword' },
      id: { type: 'integer' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      estado: { type: 'keyword' }
    }
  }
});

module.exports = {
  createIndexTemplate,
  logsTemplate,
  entityTemplate
};
```

### 🔹 **Search Templates para Consultas Reutilizables**

```javascript
// packages/shared-elasticsearch/src/templates/searchTemplates.js
const registerSearchTemplates = async (client) => {
  const templates = [
    {
      name: 'uajs_paginated_search',
      body: {
        query: {
          bool: {
            must: [
              { match: { ${{query_field}}: ${{query_value}} } }
            ],
            filter: [
              ...${{filters}}
            ]
          }
        },
        from: ${{from}},
        size: ${{size}},
        sort: [
          { ${{sort_field}}: { order: ${{sort_order}} } }
        ],
        aggs: ${{aggregations}},
        track_total_hits: true
      }
    },
    {
      name: 'uajs_date_range_search',
      body: {
        query: {
          bool: {
            must: [
              { range: { ${{date_field}}: { gte: ${{date_from}}, lte: ${{date_to}} } } }
            ],
            filter: [
              ...${{filters}}
            ]
          }
        },
        from: ${{from}},
        size: ${{size}},
        sort: [ { ${{date_field}}: { order: 'desc' } } ]
      }
    },
    {
      name: 'uajs_full_text_search',
      body: {
        query: {
          multi_match: {
            query: ${{query}},
            fields: ${{fields}},
            fuzziness: ${{fuzziness}},
            operator: 'and'
          }
        },
        highlight: {
          fields: ${{fields}},
          pre_tags: ['<em>'],
          post_tags: ['</em>']
        },
        from: ${{from}},
        size: ${{size}}
      }
    },
    {
      name: 'uajs_aggregation_search',
      body: {
        query: ${{query}},
        aggs: ${{aggregations}},
        size: 0
      }
    }
  ];

  for (const template of templates) {
    await client.putScript({
      id: template.name,
      body: template.body
    });
  }
};

// Función para usar templates
const useSearchTemplate = (client, templateName, params) => {
  return client.searchTemplate({
    body: {
      id: templateName,
      params
    }
  });
};

module.exports = { registerSearchTemplates, useSearchTemplate };
```

### 🔹 **Configuración de Monitoring y Métricas**

```javascript
// packages/shared-elasticsearch/src/utils/monitoring.js
const collectMetrics = (client) => {
  return {
    // Métricas de cluster
    clusterHealth: async () => {
      const health = await client.cluster.health();
      return {
        status: health.body.status,
        nodes: health.body.number_of_nodes,
        shards: health.body.active_shards,
        unassignedShards: health.body.unassigned_shards,
      };
    },

    // Métricas de índices
    indexStats: async (indexPattern = '*') => {
      const stats = await client.indices.stats({ index: indexPattern });
      const indices = Object.keys(stats.body.indices);

      return indices.map((index) => ({
        index,
        docs: stats.body.indices[index].total.docs.count,
        size: stats.body.indices[index].total.store.size_in_bytes,
        queryTime: stats.body.indices[index].total.search.query_time_in_millis,
        indexTime: stats.body.indices[index].total.indexing.index_time_in_millis,
      }));
    },

    // Métricas de nodos
    nodeStats: async () => {
      const nodes = await client.nodes.stats();
      return Object.values(nodes.body.nodes).map((node) => ({
        name: node.name,
        cpu: node.process.cpu.percent,
        memory: node.process.mem.total_in_bytes,
        heap: node.jvm.mem.heap_used_in_bytes,
        disk: node.fs.total.total_in_bytes,
        uptime: node.process.uptime_in_millis,
      }));
    },

    // Métricas de bulk operations
    bulkStats: async () => {
      const stats = await client.nodes.stats({ metric: 'bulk' });
      return Object.values(stats.body.nodes).map((node) => ({
        name: node.name,
        bulkOperations: node.thread_pool.bulk.queue + node.thread_pool.bulk.active,
        bulkRejected: node.thread_pool.bulk.rejected,
      }));
    },
  };
};

// Middleware para exponer métricas
const metricsMiddleware = (client) => {
  const metrics = collectMetrics(client);

  return async (req, res, next) => {
    if (req.path === '/metrics/es') {
      try {
        const [health, indices, nodes, bulk] = await Promise.all([
          metrics.clusterHealth(),
          metrics.indexStats(),
          metrics.nodeStats(),
          metrics.bulkStats(),
        ]);

        res.json({
          elasticsearch: {
            cluster: health,
            indices,
            nodes,
            bulk,
          },
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
      return;
    }
    next();
  };
};

module.exports = { collectMetrics, metricsMiddleware };
```

---

## 📦 **BLOQUE 1: Infraestructura y Cimientos Enterprise (4 Prompts)**

---

### 🔥 **Prompt 1 — Inicialización del Monorepo Enterprise Grade**

**Objetivo:** Crear el script de inicialización **Enterprise** que genera las 295 carpetas, configura Turborepo con caché remoto, y prepara el entorno para múltiples entornos (dev, staging, prod).

**Archivos a generar (20 archivos):**

| #   | Archivo                         | Descripción Enterprise                      |
| --- | ------------------------------- | ------------------------------------------- |
| 1   | `init-structure.sh`             | Script con validación de permisos y logging |
| 2   | `package.json`                  | Workspaces + scripts enterprise             |
| 3   | `turbo.json`                    | Cache remoto + pipelines optimizados        |
| 4   | `.eslintrc.js`                  | Reglas Airbnb + plugins de seguridad        |
| 5   | `.prettierrc`                   | Configuración estricta                      |
| 6   | `.gitignore`                    | Excluye archivos sensibles                  |
| 7   | `.nvmrc`                        | Node.js 20 LTS                              |
| 8   | `jsconfig.json`                 | Path mappings para imports                  |
| 9   | `.env.example`                  | Variables para todos los entornos           |
| 10  | `.env.development`              | Configuración local                         |
| 11  | `.env.staging`                  | Configuración staging                       |
| 12  | `.env.production`               | Configuración producción                    |
| 13  | `.husky/pre-commit`             | lint-staged + security checks               |
| 14  | `.husky/commit-msg`             | commitlint + conventional commits           |
| 15  | `.husky/pre-push`               | Tests antes de push                         |
| 16  | `scripts/validate-env.js`       | Validación de variables                     |
| 17  | `scripts/check-dependencies.js` | Verificación de vulnerabilidades            |
| 18  | `scripts/generate-secrets.js`   | Generación de secrets                       |
| 19  | `SECURITY.md`                   | Política de seguridad enterprise            |
| 20  | `.npmrc`                        | Configuración de registry privado           |

**Instrucciones del prompt:**

````bash
# Eres un Arquitecto Enterprise. Genera código de nivel producción para UAJS Smart Campus v2.1.

CONTEXTO ENTERPRISE:
- Monorepo con Turborepo y caché remoto (Vercel, Azure, o S3)
- Múltiples entornos: development, staging, production
- Integración CI/CD con GitHub Actions
- Escaneo de vulnerabilidades con Snyk/Dependabot
- Gestión de secrets con Vault/AWS Secrets Manager

TAREA 1 — INIT-STRUCTURE.SH (Enterprise):
```bash
#!/bin/bash
set -euo pipefail

# Validaciones previas
if [ ! -d ".git" ]; then
  echo "❌ Error: Ejecuta este script desde el root del repositorio"
  exit 1
fi

if [ "$(whoami)" = "root" ]; then
  echo "⚠️  Advertencia: Ejecutando como root. Considera usar un usuario no privilegiado."
fi

# Contador de carpetas
CREATED_DIRS=0
TOTAL_DIRS=295

# Función para crear carpetas con logging
create_dir() {
  if [ ! -d "$1" ]; then
    mkdir -p "$1"
    echo "✅ Creada: $1"
    ((CREATED_DIRS++))
  else
    echo "ℹ️  Ya existe: $1"
  fi
}

# Crear estructura base
echo "🚀 Creando estructura de carpetas Enterprise (295 totales)..."

# Apps (12 servicios)
for service in api-gateway auth-service user-service catalog-service university-service \
  resource-service booking-service request-service event-service \
  notification-service pqrs-service storage-service; do
  create_dir "apps/$service/src/config"
  create_dir "apps/$service/src/config/database"
  create_dir "apps/$service/src/config/elasticsearch"  # NUEVO
  create_dir "apps/$service/src/core/exceptions"
  create_dir "apps/$service/src/core/loaders"
  create_dir "apps/$service/src/core/helpers"
  create_dir "apps/$service/src/core/rateLimiter"
  create_dir "apps/$service/src/middleware"
  create_dir "apps/$service/src/routes"
  create_dir "apps/$service/src/modules"
  create_dir "apps/$service/src/jobs/producers"
  create_dir "apps/$service/src/jobs/consumers"
  create_dir "apps/$service/src/docs"
  create_dir "apps/$service/tests/unit"
  create_dir "apps/$service/tests/integration"
  create_dir "apps/$service/tests/e2e"
  create_dir "apps/$service/tests/fixtures"

  # Archivos raíz del servicio
  for file in package.json Dockerfile .env.example .env.development .env.staging .env.production README.md; do
    touch "apps/$service/$file"
  done
done

# Packages (4 paquetes compartidos)
for pkg in shared-types shared-utils database-client shared-elasticsearch; do
  create_dir "packages/$pkg/src"
  for subdir in mappings queries utils; do
    create_dir "packages/$pkg/src/$subdir"
  done
  touch "packages/$pkg/package.json"
  touch "packages/$pkg/index.js"
  touch "packages/$pkg/README.md"
done

# Infraestructura
create_dir "infrastructure/docker/init"
create_dir "infrastructure/docker"
create_dir "infrastructure/kubernetes"
for service in api-gateway auth-service user-service catalog-service university-service \
  resource-service booking-service request-service event-service \
  notification-service pqrs-service storage-service; do
  create_dir "infrastructure/kubernetes/$service"
done
create_dir "infrastructure/elasticsearch"
create_dir "infrastructure/elasticsearch/kubernetes"
create_dir "infrastructure/elasticsearch/config"
create_dir "infrastructure/elasticsearch/scripts"
create_dir "infrastructure/secrets"
create_dir "infrastructure/nginx"

# Scripts
create_dir "scripts/seed"
create_dir "scripts/migrations"
create_dir "scripts/elasticsearch"

# Docs
create_dir "docs"

# GitHub
create_dir ".github/workflows"

# Husky
create_dir ".husky"

# Archivos raíz
for file in package.json turbo.json .eslintrc.js .prettierrc .gitignore .nvmrc jsconfig.json \
  .npmrc SECURITY.md README.md; do
  touch "$file"
done

echo ""
echo "✅ Estructura completada: $CREATED_DIRS/$TOTAL_DIRS carpetas creadas"

if [ $CREATED_DIRS -eq $TOTAL_DIRS ]; then
  echo "🎉 Todas las carpetas han sido creadas correctamente"
else
  echo "⚠️  Advertencia: Se crearon $CREATED_DIRS de $TOTAL_DIRS carpetas"
fi
````

TAREA 2 — PACKAGE.JSON RAÍZ (Enterprise):

```json
{
  "name": "uajs-smart-campus-monorepo",
  "version": "2.1.0",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:watch": "turbo run test --watch",
    "test:coverage": "turbo run test -- --coverage",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint -- --fix",
    "format": "prettier --write \"**/*.{js,json,md,yaml,yml}\"",
    "format:check": "prettier --check \"**/*.{js,json,md,yaml,yml}\"",
    "validate:env": "node scripts/validate-env.js",
    "check:deps": "node scripts/check-dependencies.js",
    "generate:secrets": "node scripts/generate-secrets.js",
    "docker:up": "docker compose -f infrastructure/docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f infrastructure/docker/docker-compose.yml down",
    "docker:logs": "docker compose -f infrastructure/docker/docker-compose.yml logs -f",
    "es:setup": "node scripts/elasticsearch/setup-mappings.js",
    "es:seed": "node scripts/seed/seed-elasticsearch.js",
    "es:index": "node scripts/elasticsearch/index-all.js",
    "es:reindex": "node scripts/elasticsearch/reindex.js"
  },
  "devDependencies": {
    "turbo": "^1.12.0",
    "eslint": "^8.56.0",
    "eslint-config-airbnb": "^19.0.4",
    "eslint-plugin-security": "^2.1.0",
    "eslint-plugin-sonarjs": "^0.23.0",
    "eslint-plugin-unicorn": "^51.0.1",
    "prettier": "^3.1.1",
    "husky": "^8.0.3",
    "lint-staged": "^15.2.0",
    "@commitlint/cli": "^18.6.0",
    "@commitlint/config-conventional": "^18.6.0",
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.0",
    "@types/jest": "^29.5.12",
    "@types/uuid": "^9.0.7"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  },
  "packageManager": "npm@10.2.3",
  "resolutions": {
    "minimist": "^1.2.8",
    "json5": "^2.2.3"
  }
}
```

TAREA 3 — TURBO.JSON (Enterprise):

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "**/.env.*local",
    "package.json",
    "turbo.json",
    ".eslintrc.js",
    ".prettierrc"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true,
      "env": ["NODE_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": [],
      "cache": false,
      "env": ["NODE_ENV", "MYSQL_HOST", "REDIS_HOST", "ELASTICSEARCH_HOST"]
    },
    "lint": {
      "outputs": [],
      "cache": false
    },
    "^build": {
      "cache": true,
      "env": ["NODE_ENV"]
    }
  },
  "remoteCache": {
    "enabled": true,
    "teamId": "uajs-smart-campus",
    "apiUrl": "https://remote-cache.turbo.build"
  }
}
```

TAREA 4 — SCRIPTS DE VALIDACIÓN ENTERPRISE:

`scripts/validate-env.js`:

```javascript
const fs = require('fs');
const path = require('path');
const { z } = require('zod');

// Schema para validación de variables de entorno
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // MySQL
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(8),
  MYSQL_DATABASE: z.string().min(1),

  // Redis
  REDIS_HOST: z.string().min(1),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Elasticsearch
  ELASTICSEARCH_HOST: z.string().min(1),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  ELASTICSEARCH_USER: z.string().min(1),
  ELASTICSEARCH_PASSWORD: z.string().min(8),
  ELASTICSEARCH_CA_CERT: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_MIN: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Service Auth
  SERVICE_AUTH_TOKEN: z.string().min(32),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().transform((val) => val.split(',')),

  // Rate Limiting
  RATE_LIMIT_BUCKET_CAPACITY: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_REFILL_PER_SEC: z.coerce.number().int().positive().default(10),
});

const validateEnv = (envPath) => {
  const env = require('dotenv').config({ path: envPath, silent: true }).parsed || {};

  try {
    envSchema.parse(env);
    console.log(`✅ ${path.basename(envPath)} es válido`);
    return true;
  } catch (error) {
    console.error(`❌ Error en ${path.basename(envPath)}:`);
    error.errors.forEach((err) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    return false;
  }
};

// Validar todos los archivos .env
const envFiles = ['.env.development', '.env.staging', '.env.production', '.env.example'];

let allValid = true;
for (const file of envFiles) {
  if (fs.existsSync(file)) {
    if (!validateEnv(file)) {
      allValid = false;
    }
  }
}

if (!allValid) {
  process.exit(1);
}

console.log('🎉 Todos los archivos de entorno son válidos');
```

`scripts/check-dependencies.js`:

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Verificar vulnerabilidades con npm audit
const checkVulnerabilities = () => {
  try {
    console.log('🔍 Verificando vulnerabilidades con npm audit...');
    const output = execSync('npm audit --json', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    const audit = JSON.parse(output);

    if (audit.vulnerabilities && Object.keys(audit.vulnerabilities).length > 0) {
      console.error('❌ Vulnerabilidades encontradas:');
      for (const [pkg, issues] of Object.entries(audit.vulnerabilities)) {
        console.error(`  - ${pkg}:`);
        issues.forEach((issue) => {
          console.error(`    * ${issue.via.join(' → ')}`);
        });
      }
      return false;
    }

    console.log('✅ No se encontraron vulnerabilidades críticas');
    return true;
  } catch (error) {
    console.error('❌ Error al ejecutar npm audit:', error.message);
    return false;
  }
};

// Verificar licencias de dependencias
const checkLicenses = () => {
  try {
    console.log('📜 Verificando licencias de dependencias...');
    const output = execSync('npx license-checker --summary --json', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    const licenses = JSON.parse(output);
    const forbiddenLicenses = ['GPL', 'AGPL', 'LGPL', 'MPL', 'EPL'];

    const forbiddenDeps = Object.entries(licenses).filter(([pkg, license]) => {
      return forbiddenLicenses.some((fl) => license.includes(fl));
    });

    if (forbiddenDeps.length > 0) {
      console.error('❌ Dependencias con licencias prohibidas:');
      forbiddenDeps.forEach(([pkg, license]) => {
        console.error(`  - ${pkg}: ${license}`);
      });
      return false;
    }

    console.log('✅ Todas las dependencias tienen licencias permitidas');
    return true;
  } catch (error) {
    console.error('⚠️  No se pudo verificar licencias:', error.message);
    return true; // No bloquear por este error
  }
};

// Verificar dependencias obsoletas
const checkOutdated = () => {
  try {
    console.log('🔄 Verificando dependencias obsoletas...');
    const output = execSync('npx npm-check -u --no-color', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    const outdated = output.split('\n').filter((line) => line.includes('↑'));

    if (outdated.length > 0) {
      console.log('ℹ️  Dependencias con actualizaciones disponibles:');
      outdated.forEach((line) => console.log(`  - ${line}`));
    } else {
      console.log('✅ Todas las dependencias están actualizadas');
    }

    return true;
  } catch (error) {
    console.error('⚠️  No se pudo verificar dependencias obsoletas:', error.message);
    return true;
  }
};

// Ejecutar todas las verificaciones
const allChecks = [checkVulnerabilities(), checkLicenses(), checkOutdated()];

Promise.all(allChecks).then((results) => {
  if (results.every((r) => r)) {
    console.log('🎉 Todas las verificaciones de dependencias pasaron');
    process.exit(0);
  } else {
    console.error('❌ Algunas verificaciones fallaron');
    process.exit(1);
  }
});
```

`scripts/generate-secrets.js`:

```javascript
const crypto = require('crypto');
const fs = require('fs');

// Generar secrets seguros
const generateSecureToken = (bytes = 32) => {
  return crypto
    .randomBytes(bytes)
    .toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, bytes * 2);
};

const generateSecrets = () => {
  const secrets = {
    // JWT
    JWT_SECRET: generateSecureToken(64),

    // Service Auth
    SERVICE_AUTH_TOKEN: generateSecureToken(64),

    // MySQL
    MYSQL_ROOT_PASSWORD: generateSecureToken(32),
    MYSQL_USER: 'uajs_app',
    MYSQL_PASSWORD: generateSecureToken(32),

    // Redis
    REDIS_PASSWORD: generateSecureToken(32),

    // Elasticsearch
    ELASTICSEARCH_PASSWORD: generateSecureToken(32),
    ELASTICSEARCH_API_KEY: generateSecureToken(64),

    // SMTP
    SMTP_USER: 'uajs-noreply@uajs.edu.co',
    SMTP_PASSWORD: generateSecureToken(32),
  };

  // Escribir en archivo
  const output = Object.entries(secrets)
    .map(([key, value]) => {
      return `${key}=${value}`;
    })
    .join('\n');

  fs.writeFileSync('.env.secrets', output + '\n');
  console.log('✅ Secrets generados en .env.secrets');
  console.log('⚠️  Añade .env.secrets a .gitignore');
  console.log('\nEjemplo de contenido:');
  console.log(output.substring(0, 200) + '...');
};

generateSecrets();
```

PUERTA DE VERIFICACIÓN:

- ✅ `init-structure.sh` crea exactamente 295 carpetas
- ✅ `package.json` es válido y tiene scripts enterprise
- ✅ `turbo.json` tiene configuración de caché remoto
- ✅ Los scripts de validación ejecutan sin errores
- ✅ `.env.example` incluye todas las variables necesarias
- ✅ `SECURITY.md` tiene política de seguridad enterprise

```

---

### 🔥 **Prompt 2 — Infraestructura Local Enterprise: Docker Compose + MySQL + Redis + Elasticsearch 8.x**

**Objetivo:** Crear configuración **Enterprise-Grade** para Docker Compose con MySQL 8, Redis (AOF + Cluster Mode), Elasticsearch 8.x (Seguridad habilitada, TLS), Kibana, y los 12 servicios con healthchecks avanzados.

**Archivos a generar (15 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1 | `infrastructure/docker/init/01-schema.sql` | SQL + ILM para ES |
| 2 | `infrastructure/docker/docker-compose.yml` | Stack completo |
| 3 | `infrastructure/docker/docker-compose.override.yml` | Overrides local |
| 4 | `infrastructure/docker/Dockerfile.base` | Imagen base optimizada |
| 5 | `infrastructure/docker/README.md` | Docs enterprise |
| 6 | `infrastructure/elasticsearch/docker-compose.yml` | ES standalone |
| 7 | `infrastructure/elasticsearch/config/elasticsearch.yml` | Config ES |
| 8 | `infrastructure/elasticsearch/config/kibana.yml` | Config Kibana |
| 9 | `infrastructure/elasticsearch/scripts/setup.sh` | Setup inicial |
| 10 | `infrastructure/elasticsearch/README.md` | Docs ES |
| 11 | `infrastructure/secrets/elasticsearch.env.example` | Secrets ES |
| 12 | `scripts/migrations/migrate.js` | Runner migraciones |
| 13 | `scripts/migrations/ms-*_001_init.sql` | Migraciones iniciales por servicio (8) |
| 14 | `scripts/elasticsearch/setup-mappings.js` | Setup mapeos |
| 15 | `scripts/elasticsearch/setup-ilm.js` | Setup ILM |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Infraestructura Enterprise. Genera configuración de nivel producción.

TAREA 1 — DOCKER-COMPOSE.YML (Enterprise):

```yaml
version: '3.8'

x-defaults: &defaults
  restart: unless-stopped
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:9200']
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s

services:
  # MySQL 8.0
  mysql:
    image: mysql:8.0.36
    container_name: uajs-mysql
    ports:
      - '3306:3306'
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-changeme}
      MYSQL_DATABASE: uajs_smart_campus
      MYSQL_USER: ${MYSQL_USER:-uajs_app}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-changeme}
      TZ: America/Bogota
    volumes:
      - mysql_data:/var/lib/mysql
      - ./infrastructure/docker/init:/docker-entrypoint-initdb.d
    command:
      [
        '--character-set-server=utf8mb4',
        '--collation-server=utf8mb4_unicode_ci',
        '--default-authentication-plugin=mysql_native_password',
        '--innodb_buffer_pool_size=1G',
        '--max_connections=200',
      ]
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - uajs-network
    <<: *defaults

  # Redis 7 con AOF y Cluster Mode
  redis:
    image: redis:7.2.4-alpine
    container_name: uajs-redis
    ports:
      - '6379:6379'
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD:-}
      REDIS_AOF_ENABLED: 'yes'
      REDIS_APPENDONLY: 'yes'
      REDIS_APPENDFSYNC: 'everysec'
    command:
      [
        'redis-server',
        '--appendonly',
        'yes',
        '--requirepass',
        '${REDIS_PASSWORD:-}',
        '--maxmemory',
        '1gb',
        '--maxmemory-policy',
        'allkeys-lru',
      ]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - uajs-network
    <<: *defaults

  # Elasticsearch 8.12.x
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
    container_name: uajs-elasticsearch
    ports:
      - '9200:9200'
      - '9300:9300'
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - xpack.security.http.ssl.enabled=true
      - xpack.security.http.ssl.key=certs/elasticsearch.key
      - xpack.security.http.ssl.certificate=certs/elasticsearch.crt
      - xpack.security.http.ssl.certificate_authorities=certs/ca.crt
      - xpack.security.transport.ssl.enabled=true
      - xpack.security.transport.ssl.key=certs/elasticsearch.key
      - xpack.security.transport.ssl.certificate=certs/elasticsearch.crt
      - xpack.security.transport.ssl.certificate_authorities=certs/ca.crt
      - xpack.security.transport.ssl.verification_mode=certificate
      - ELASTIC_PASSWORD=${ELASTICSEARCH_PASSWORD:-changeme}
      - bootstrap.memory_lock=true
      - 'ES_JAVA_OPTS=-Xms1g -Xmx1g -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0'
    volumes:
      - es_data:/usr/share/elasticsearch/data
      - ./infrastructure/elasticsearch/certs:/usr/share/elasticsearch/config/certs
      - ./infrastructure/elasticsearch/config/elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml
    ulimits:
      memlock:
        soft: -1
        hard: -1
    healthcheck:
      test:
        [
          'CMD',
          'curl',
          '-k',
          '-u',
          'elastic:${ELASTICSEARCH_PASSWORD:-changeme}',
          'https://localhost:9200',
        ]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s
    networks:
      - uajs-network
    <<: *defaults

  # Kibana
  kibana:
    image: docker.elastic.co/kibana/kibana:8.12.0
    container_name: uajs-kibana
    ports:
      - '5601:5601'
    environment:
      ELASTICSEARCH_HOSTS: https://elasticsearch:9200
      ELASTICSEARCH_USERNAME: elastic
      ELASTICSEARCH_PASSWORD: ${ELASTICSEARCH_PASSWORD:-changeme}
      ELASTICSEARCH_SSL_CERTIFICATEAUTHORITIES: /usr/share/kibana/config/certs/ca.crt
      ELASTICSEARCH_SSL_VERIFICATIONMODE: certificate
    volumes:
      - ./infrastructure/elasticsearch/certs:/usr/share/kibana/config/certs
      - ./infrastructure/elasticsearch/config/kibana.yml:/usr/share/kibana/config/kibana.yml
    depends_on:
      elasticsearch:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-k', '-I', 'http://localhost:5601']
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - uajs-network
    <<: *defaults

  # 12 Servicios (ejemplo para api-gateway)
  api-gateway:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.base
    container_name: uajs-api-gateway
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3000
      MYSQL_HOST: mysql
      MYSQL_PORT: 3306
      MYSQL_USER: ${MYSQL_USER:-uajs_app}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-changeme}
      MYSQL_DATABASE: uajs_smart_campus
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:-}
      ELASTICSEARCH_HOST: elasticsearch
      ELASTICSEARCH_PORT: 9200
      ELASTICSEARCH_USER: elastic
      ELASTICSEARCH_PASSWORD: ${ELASTICSEARCH_PASSWORD:-changeme}
      JWT_SECRET: ${JWT_SECRET:-changeme}
      SERVICE_AUTH_TOKEN: ${SERVICE_AUTH_TOKEN:-changeme}
      CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-*}
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health/liveness']
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - uajs-network
    <<: *defaults

  # ... (repetir para los otros 11 servicios con sus respectivos puertos)

volumes:
  mysql_data:
  redis_data:
  es_data:

networks:
  uajs-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

TAREA 2 — ELASTICSEARCH.CONFIG/ELASTICSEARCH.YML:

```yaml
cluster.name: uajs-smart-campus
network.host: 0.0.0.0
network.publish_host: _site_

# Node Roles
node.roles: [master, data, ingest, ml]

# Paths
path.data: /usr/share/elasticsearch/data
path.logs: /usr/share/elasticsearch/logs
path.conf: /usr/share/elasticsearch/config

# Memory
bootstrap.memory_lock: true

# Security
xpack.security.enabled: true
xpack.security.transport.ssl.enabled: true
xpack.security.transport.ssl.verification_mode: certificate
xpack.security.http.ssl.enabled: true
xpack.security.http.ssl.verification_mode: certificate

# Authentication
xpack.security.authc.api_key.enabled: true
xpack.security.authc.token.enabled: true

# TLS Certificates
xpack.security.http.ssl.certificate: certs/elasticsearch.crt
xpack.security.http.ssl.key: certs/elasticsearch.key
xpack.security.http.ssl.certificate_authorities: certs/ca.crt
xpack.security.transport.ssl.certificate: certs/elasticsearch.crt
xpack.security.transport.ssl.key: certs/elasticsearch.key
xpack.security.transport.ssl.certificate_authorities: certs/ca.crt

# Cluster Settings
cluster.initial_master_nodes: uajs-elasticsearch
cluster.routing.allocation.disk.watermark.low: 85%
cluster.routing.allocation.disk.watermark.high: 90%
cluster.routing.allocation.disk.watermark.flood_stage: 95%

# Thread Pools
thread_pool.write.queue_size: 1000
thread_pool.search.queue_size: 1000
thread_pool.bulk.queue_size: 1000

# Circuit Breakers
indices.breaker.total.limit: 70%
indices.breaker.fielddata.limit: 40%
indices.breaker.request.limit: 60%

# Slow Logs
index.search.slowlog.threshold.query.warn: 10s
index.search.slowlog.threshold.query.info: 5s
index.search.slowlog.threshold.query.debug: 2s
index.search.slowlog.threshold.fetch.warn: 1s
index.search.slowlog.threshold.fetch.info: 800ms
index.search.slowlog.threshold.fetch.debug: 500ms

# Index Settings
index.number_of_shards: 3
index.number_of_replicas: 1
index.refresh_interval: 30s
index.max_result_window: 100000

# Query Settings
search.max_buckets: 100000

# Logging
logger.org.elasticsearch: INFO
logger.org.elasticsearch.index: WARN
```

TAREA 3 — ELASTICSEARCH.CONFIG/KIBANA.YML:

```yaml
server.host: 0.0.0.0
server.port: 5601

# Elasticsearch Connection
elasticsearch.hosts: ['https://elasticsearch:9200']
elasticsearch.username: elastic
elasticsearch.password: ${ELASTICSEARCH_PASSWORD}
elasticsearch.ssl.certificateAuthorities: ['/usr/share/kibana/config/certs/ca.crt']
elasticsearch.ssl.verificationMode: certificate

# Security
xpack.security.enabled: true
xpack.security.session.timeout: 8h

# Monitoring
monitoring.ui.container.elasticsearch.enabled: true

# Console
console.proxyFilter: ['*.amazonaws.com', 'localhost', '127.0.0.1', '0.0.0.0', '::1']
console.proxyConfig: ['http', 'https']

# CORS
server.cors.enabled: true
server.cors.origin: ['http://localhost:3000', 'https://uajs.edu.co']
server.cors.methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE']
server.cors.headers: ['Authorization', 'Content-Type', 'X-Request-Id']

# Logging
logging.dest: /var/log/kibana/kibana.log
logging.level: info
```

TAREA 4 — DOCKER-COMPOSE.OVERRIDE.YML (Desarrollo Local):

```yaml
version: '3.8'

services:
  elasticsearch:
    environment:
      xpack.security.enabled: false
      xpack.security.http.ssl.enabled: false
      xpack.security.transport.ssl.enabled: false
      discovery.type: single-node
      "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
      - "9300:9300"
    volumes:
      - ./infrastructure/elasticsearch/data:/usr/share/elasticsearch/data

  kibana:
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
      ELASTICSEARCH_USERNAME:
      ELASTICSEARCH_PASSWORD:
      ELASTICSEARCH_SSL_VERIFICATIONMODE: none
    ports:
      - "5601:5601"

  # Descomentar para desarrollo con hot-reload
  api-gateway:
    volumes:
      - ./apps/api-gateway:/app
      - /app/node_modules
    environment:
      NODE_ENV: development
    command: npm run dev
```

TAREA 5 — DOCKERFILE.BASE (Enterprise):

```dockerfile
# Stage 1: Build
FROM node:20.11.1-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json ./
COPY turbo.json ./
COPY .npmrc ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Runtime
FROM node:20.11.1-alpine AS runtime

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY --chown=nodejs:nodejs apps ./apps
COPY --chown=nodejs:nodejs packages ./packages
COPY --chown=nodejs:nodejs infrastructure ./infrastructure
COPY --chown=nodejs:nodejs scripts ./scripts
COPY --chown=nodejs:nodejs .env.example ./

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Expose port (will be set by individual Dockerfiles)
EXPOSE 3000

# Start command (will be overridden)
CMD ["node", "apps/api-gateway/src/server.js"]
```

TAREA 6 — SCRIPTS/MIGRATIONS/MIGRATE.JS (Enterprise):

```javascript
const fs = require('fs');
const path = require('path');
const { createPool } = require('mysql2/promise');

class MigrationRunner {
  constructor({ host, port, user, password, database }) {
    this.pool = createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    this.migrationsDir = path.join(__dirname, 'migrations');
    this.migrationsTable = '_migrations';
  }

  async ensureMigrationsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (name)
      )
    `);
  }

  async getExecutedMigrations() {
    const [rows] = await this.pool.query(`
      SELECT name FROM ${this.migrationsTable}
    `);
    return rows.map((row) => row.name);
  }

  async getPendingMigrations() {
    const executed = await this.getExecutedMigrations();
    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    return files.filter((f) => !executed.includes(f));
  }

  async executeMigration(fileName) {
    const filePath = path.join(this.migrationsDir, fileName);
    const sql = fs.readFileSync(filePath, 'utf8');

    await this.pool.query(sql);

    await this.pool.query(
      `
      INSERT INTO ${this.migrationsTable} (name) VALUES (?)
    `,
      [fileName],
    );

    console.log(`✅ Migration executed: ${fileName}`);
  }

  async up() {
    await this.ensureMigrationsTable();
    const pending = await this.getPendingMigrations();

    for (const migration of pending) {
      try {
        await this.executeMigration(migration);
      } catch (error) {
        console.error(`❌ Error executing migration ${migration}:`, error.message);
        throw error;
      }
    }

    console.log(`🎉 All ${pending.length} migrations executed successfully`);
  }

  async down(name) {
    // Implementar rollback si es necesario
    console.log(`⚠️  Rollback not implemented for ${name}`);
  }

  async status() {
    await this.ensureMigrationsTable();
    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();

    console.log('\n📋 Migration Status:');
    console.log(`✅ Executed: ${executed.length}`);
    executed.forEach((name) => console.log(`   - ${name}`));
    console.log(`⏳ Pending: ${pending.length}`);
    pending.forEach((name) => console.log(`   - ${name}`));
  }

  async close() {
    await this.pool.end();
  }
}

// CLI
const main = async () => {
  const args = process.argv.slice(2);
  const command = args[0];

  const runner = new MigrationRunner({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'uajs_smart_campus',
  });

  try {
    switch (command) {
      case 'up':
        await runner.up();
        break;
      case 'down':
        await runner.down(args[1]);
        break;
      case 'status':
        await runner.status();
        break;
      default:
        console.log('Usage: node migrate.js [up|down|status]');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await runner.close();
  }
};

main();
```

TAREA 7 — SCRIPTS/ELASTICSEARCH/SETUP-MAPPINGS.JS:

```javascript
const { createResilientElasticsearchClient } = require('@uajs/shared-elasticsearch');
const { createIndexWithILM } = require('@uajs/shared-elasticsearch/src/ilm');
const { mappings } = require('@uajs/shared-elasticsearch');

const setupMappings = async () => {
  const client = createResilientElasticsearchClient({
    host: process.env.ELASTICSEARCH_HOST || 'localhost',
    port: process.env.ELASTICSEARCH_PORT || '9200',
    user: process.env.ELASTICSEARCH_USER || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  });

  try {
    // Verificar conexión
    console.log('🔍 Verificando conexión a Elasticsearch...');
    await client.ping();
    console.log('✅ Conexión exitosa');

    // Crear políticas ILM
    console.log('📝 Creando políticas ILM...');

    const ilmPolicies = {
      uajs_logs_policy: {
        phases: {
          hot: {
            min_age: '0ms',
            actions: {
              rollover: {
                max_size: '50GB',
                max_age: '1d',
              },
              set_priority: {
                priority: 100,
              },
            },
          },
          warm: {
            min_age: '1d',
            actions: {
              forcemerge: {
                max_num_segments: 1,
              },
              set_priority: {
                priority: 50,
              },
            },
          },
          delete: {
            min_age: '30d',
            actions: {
              delete: {},
            },
          },
        },
      },
      uajs_default_policy: {
        phases: {
          hot: {
            min_age: '0ms',
            actions: {
              rollover: {
                max_size: '50GB',
                max_age: '30d',
              },
            },
          },
          delete: {
            min_age: '90d',
            actions: {
              delete: {},
            },
          },
        },
      },
    };

    for (const [name, policy] of Object.entries(ilmPolicies)) {
      try {
        await client.ilm.putLifecycle({
          name,
          body: { policy },
        });
        console.log(`✅ Política ILM creada: ${name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Política ILM ya existe: ${name}`);
        } else {
          throw error;
        }
      }
    }

    // Crear índices con mapeos
    console.log('🗂️  Creando índices con mapeos...');

    const indexConfigs = [
      { name: 'uajs_logs', mapping: mappings.logs, ilmPolicy: 'uajs_logs_policy' },
      { name: 'uajs_users', mapping: mappings.user, ilmPolicy: 'uajs_default_policy' },
      { name: 'uajs_terceros', mapping: mappings.university, ilmPolicy: 'uajs_default_policy' },
      { name: 'uajs_recursos', mapping: mappings.resource, ilmPolicy: 'uajs_default_policy' },
      { name: 'uajs_reservas', mapping: mappings.booking, ilmPolicy: 'uajs_default_policy' },
      { name: 'uajs_solicitudes', mapping: mappings.request, ilmPolicy: 'uajs_default_policy' },
      { name: 'uajs_eventos', mapping: mappings.event, ilmPolicy: 'uajs_default_policy' },
      {
        name: 'uajs_notificaciones',
        mapping: mappings.notification,
        ilmPolicy: 'uajs_default_policy',
      },
      { name: 'uajs_pqrs', mapping: mappings.pqrs, ilmPolicy: 'uajs_default_policy' },
      { name: 'uajs_archivos', mapping: mappings.storage, ilmPolicy: 'uajs_default_policy' },
    ];

    for (const { name, mapping, ilmPolicy } of indexConfigs) {
      try {
        await createIndexWithILM(client.client, name, mapping, ilmPolicy);
        console.log(`✅ Índice creado: ${name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Índice ya existe: ${name}`);
        } else {
          console.error(`❌ Error creando índice ${name}:`, error.message);
        }
      }
    }

    // Crear aliases
    console.log('🔗 Creando aliases...');
    for (const { name } of indexConfigs) {
      try {
        await client.client.indices.putAlias({
          index: name,
          name: name.replace('uajs_', ''),
        });
        console.log(`✅ Alias creado: ${name.replace('uajs_', '')} -> ${name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Alias ya existe: ${name.replace('uajs_', '')}`);
        }
      }
    }

    console.log('🎉 Setup de mapeos completado');
  } catch (error) {
    console.error('❌ Error en setup:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

setupMappings();
```

TAREA 8 — SCRIPTS/ELASTICSEARCH/SETUP-ILM.JS:

```javascript
const { createResilientElasticsearchClient } = require('@uajs/shared-elasticsearch');

const setupILM = async () => {
  const client = createResilientElasticsearchClient();

  try {
    // Verificar conexión
    await client.ping();

    // Configuración de ILM para logs
    const logsPolicy = {
      policy: {
        phases: {
          hot: {
            min_age: '0ms',
            actions: {
              rollover: {
                max_size: '50GB',
                max_age: '1d',
              },
              set_priority: {
                priority: 100,
              },
            },
          },
          warm: {
            min_age: '1d',
            actions: {
              forcemerge: {
                max_num_segments: 1,
              },
              shrink: {
                number_of_shards: 1,
              },
              set_priority: {
                priority: 50,
              },
            },
          },
          cold: {
            min_age: '7d',
            actions: {
              freeze: {},
            },
          },
          delete: {
            min_age: '30d',
            actions: {
              delete: {},
            },
          },
        },
      },
    };

    await client.client.ilm.putLifecycle({
      name: 'uajs_logs_policy',
      body: logsPolicy,
    });

    // Configuración de ILM para datos de negocio
    const businessPolicy = {
      policy: {
        phases: {
          hot: {
            min_age: '0ms',
            actions: {
              rollover: {
                max_size: '50GB',
                max_age: '30d',
              },
            },
          },
          delete: {
            min_age: '365d',
            actions: {
              delete: {},
            },
          },
        },
      },
    };

    await client.client.ilm.putLifecycle({
      name: 'uajs_business_policy',
      body: businessPolicy,
    });

    console.log('✅ Políticas ILM configuradas');
  } catch (error) {
    console.error('❌ Error configurando ILM:', error.message);
    process.exit(1);
  }
};

setupILM();
```

TAREA 9 — INFRASTRUCTURE/ELASTICSEARCH/SCRIPTS/SETUP.SH:

```bash
#!/bin/bash
set -euo pipefail

echo "🚀 Configurando Elasticsearch para UAJS Smart Campus..."

# Crear directorio de certificados
mkdir -p infrastructure/elasticsearch/certs

# Generar certificados auto-firmados (para desarrollo)
if [ ! -f "infrastructure/elasticsearch/certs/ca.crt" ]; then
  echo "🔐 Generando certificados auto-firmados..."

  # Generar CA
  openssl genrsa -out infrastructure/elasticsearch/certs/ca.key 2048
  openssl req -new -x509 -days 3650 -key infrastructure/elasticsearch/certs/ca.key \
    -out infrastructure/elasticsearch/certs/ca.crt -subj "/CN=UAJS CA"

  # Generar certificado para Elasticsearch
  openssl genrsa -out infrastructure/elasticsearch/certs/elasticsearch.key 2048
  openssl req -new -key infrastructure/elasticsearch/certs/elasticsearch.key \
    -out infrastructure/elasticsearch/certs/elasticsearch.csr -subj "/CN=elasticsearch"
  openssl x509 -req -days 3650 -CA infrastructure/elasticsearch/certs/ca.crt \
    -CAkey infrastructure/elasticsearch/certs/ca.key \
    -in infrastructure/elasticsearch/certs/elasticsearch.csr \
    -out infrastructure/elasticsearch/certs/elasticsearch.crt

  echo "✅ Certificados generados"
fi

# Configurar permisos
echo "🔧 Configurando permisos..."
chmod 600 infrastructure/elasticsearch/certs/*.key
chmod 644 infrastructure/elasticsearch/certs/*.crt

# Esperar a que Elasticsearch esté listo
echo "⏳ Esperando a que Elasticsearch esté listo..."
for i in {1..30}; do
  if curl -k -u elastic:${ELASTICSEARCH_PASSWORD:-changeme} https://localhost:9200 >/dev/null 2>&1; then
    echo "✅ Elasticsearch está listo"
    break
  fi
  sleep 10
done

# Ejecutar setup de mapeos
echo "🗂️  Configurando mapeos..."
node scripts/elasticsearch/setup-mappings.js

# Ejecutar setup de ILM
echo "📝 Configurando ILM..."
node scripts/elasticsearch/setup-ilm.js

echo "🎉 Configuración de Elasticsearch completada"
```

PUERTA DE VERIFICACIÓN:

- ✅ `docker compose up -d` levanta MySQL, Redis, ES, Kibana
- ✅ `curl -k -u elastic:password https://localhost:9200` → respuesta válida
- ✅ Kibana accesible en http://localhost:5601
- ✅ `node scripts/elasticsearch/setup-mappings.js` ejecuta sin errores
- ✅ Todos los índices se crean correctamente
- ✅ Políticas ILM configuradas

```

---

### 🔥 **Prompt 3 — Paquetes Compartidos Enterprise: database-client + shared-utils + shared-elasticsearch**

**Objetivo:** Crear los 3 paquetes compartidos con **resiliencia enterprise, seguridad robusta y patrones de producción avanzados**.

**Archivos a generar (35 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1-4 | `packages/database-client/*` | Pool MySQL + Redis con Circuit Breaker |
| 5-10 | `packages/shared-utils/*` | Logger, crypto, response, constants, tokenBucket |
| 11-35 | `packages/shared-elasticsearch/*` | **Paquete Enterprise completo** |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera paquetes compartidos de nivel producción.

PAQUETE 1 — DATABASE-CLIENT (Enterprise):

src/mysql.js:

```javascript
const mysql = require('mysql2/promise');
const { CircuitBreaker } = require('opossum');

class MySQLPool {
  constructor({
    host,
    port,
    user,
    password,
    database,
    connectionLimit = 20,
    queueLimit = 0,
    waitForConnections = true,
    retryConfig = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 10000,
    },
  }) {
    this.config = {
      host,
      port,
      user,
      password,
      database,
      connectionLimit,
      queueLimit,
      waitForConnections,
    };
    this.retryConfig = retryConfig;
    this.pool = null;
    this.breaker = null;
    this.initialize();
  }

  initialize() {
    this.pool = mysql.createPool(this.config);

    // Circuit Breaker para consultas
    this.breaker = new CircuitBreaker(
      async (query, params) => {
        const connection = await this.getConnection();
        try {
          const [results] = await connection.query(query, params);
          return results;
        } finally {
          connection.release();
        }
      },
      {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 60000,
      },
    );
  }

  async getConnection() {
    let retries = 0;

    while (retries < this.retryConfig.maxRetries) {
      try {
        const connection = await this.pool.getConnection();
        return connection;
      } catch (error) {
        retries++;
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, retries),
          this.retryConfig.maxDelay,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));

        if (retries === this.retryConfig.maxRetries) {
          throw new Error(`Failed to get connection after ${retries} retries: ${error.message}`);
        }
      }
    }
  }

  async query(query, params = []) {
    try {
      return await this.breaker.fire(query, params);
    } catch (error) {
      if (this.breaker.state === 'OPEN') {
        // Fallback: intentar conexión directa
        const connection = await this.getConnection();
        try {
          const [results] = await connection.query(query, params);
          return results;
        } finally {
          connection.release();
        }
      }
      throw error;
    }
  }

  async execute(query, params = []) {
    const connection = await this.getConnection();
    try {
      const [results] = await connection.execute(query, params);
      return results;
    } finally {
      connection.release();
    }
  }

  async beginTransaction() {
    const connection = await this.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  async ping() {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  getBreakerStats() {
    return {
      state: this.breaker.state,
      stats: this.breaker.stats,
    };
  }
}

const createMysqlPool = (config) => new MySQLPool(config);

module.exports = { createMysqlPool, MySQLPool };
```

src/redis.js:

```javascript
const Redis = require('ioredis');
const { CircuitBreaker } = require('opossum');

class RedisClient {
  constructor({
    host,
    port,
    password,
    db = 0,
    maxRetriesPerRequest = 5,
    retryStrategy = (times) => {
      return Math.min(times * 100, 5000);
    },
  }) {
    this.config = { host, port, password, db };
    this.client = new Redis({
      host,
      port,
      password,
      db,
      maxRetriesPerRequest,
      retryStrategy,
      enableReadyCheck: true,
      connectTimeout: 10000,
      commandQueueMaxLength: 10000,
    });

    // Circuit Breaker
    this.breaker = new CircuitBreaker(
      async (command, ...args) => {
        return this.client[command](...args);
      },
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      },
    );

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.client.on('connect', () => {
      console.log('✅ Redis conectado');
    });

    this.client.on('error', (error) => {
      console.error('❌ Error de Redis:', error.message);
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Reconectando a Redis...');
    });

    this.client.on('close', () => {
      console.log('🔴 Conexión Redis cerrada');
    });
  }

  async get(key) {
    return this.breaker.fire('get', key);
  }

  async set(key, value, ttl) {
    if (ttl) {
      return this.breaker.fire('setex', key, ttl, value);
    }
    return this.breaker.fire('set', key, value);
  }

  async del(key) {
    return this.breaker.fire('del', key);
  }

  async ping() {
    try {
      const result = await this.breaker.fire('ping');
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  async close() {
    await this.client.quit();
  }

  getBreakerStats() {
    return {
      state: this.breaker.state,
      stats: this.breaker.stats,
    };
  }
}

const createRedisClient = (config) => new RedisClient(config);

module.exports = { createRedisClient, RedisClient };
```

PAQUETE 2 — SHARED-UTILS (Enterprise):

src/tokenBucket.js (mejorado):

```javascript
class TokenBucket {
  constructor({ capacity, refillPerSecond, sweepIntervalMs = 60000, maxKeys = 10000 }) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.buckets = new Map();
    this.lastRefill = Date.now();
    this.sweepInterval = setInterval(() => this.sweep(), sweepIntervalMs);
    this.maxKeys = maxKeys;
  }

  consume(key, cost = 1) {
    const now = Date.now();
    const bucket = this.getBucket(key, now);

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      bucket.lastConsume = now;
      return {
        allowed: true,
        remaining: bucket.tokens,
        retryAfterSeconds: null,
      };
    }

    const tokensNeeded = cost - bucket.tokens;
    const retryAfterSeconds = Math.ceil(tokensNeeded / this.refillPerSecond);

    return {
      allowed: false,
      remaining: bucket.tokens,
      retryAfterSeconds,
    };
  }

  getBucket(key, now) {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: this.capacity,
        lastRefill: now,
        lastConsume: now,
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens
    const timePassed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillPerSecond;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    return bucket;
  }

  sweep() {
    const now = Date.now();
    const inactiveThreshold = now - this.sweepInterval;

    for (const [key, bucket] of this.buckets) {
      if (bucket.lastConsume < inactiveThreshold) {
        this.buckets.delete(key);
      }
    }

    // Limitar tamaño del Map
    if (this.buckets.size > this.maxKeys) {
      const keysToDelete = Array.from(this.buckets.keys()).slice(
        0,
        this.buckets.size - this.maxKeys,
      );
      for (const key of keysToDelete) {
        this.buckets.delete(key);
      }
    }
  }

  stop() {
    clearInterval(this.sweepInterval);
  }

  getStats() {
    return {
      size: this.buckets.size,
      capacity: this.capacity,
      refillPerSecond: this.refillPerSecond,
    };
  }
}

const createTokenBucket = (config) => new TokenBucket(config);

module.exports = { TokenBucket, createTokenBucket };
```

PAQUETE 3 — SHARED-ELASTICSEARCH (Enterprise Complete):

Estructura:

```
packages/shared-elasticsearch/
├── src/
│   ├── client.js              # Cliente resiliente con Circuit Breaker
│   ├── index.js               # Export principal
│   ├── ilm/
│   │   └── index.js           # ILM Policies
│   ├── mappings/
│   │   ├── index.js           # Indexador de mapeos
│   │   ├── user.mapping.js    # Mapping usuarios
│   │   ├── event.mapping.js   # Mapping eventos
│   │   ├── resource.mapping.js
│   │   ├── booking.mapping.js
│   │   ├── catalog.mapping.js
│   │   ├── university.mapping.js
│   │   ├── request.mapping.js
│   │   ├── notification.mapping.js
│   │   ├── pqrs.mapping.js
│   │   ├── storage.mapping.js
│   │   ├── auth.mapping.js
│   │   └── gateway.mapping.js
│   ├── queries/
│   │   ├── index.js           # Export queries
│   │   ├── logs.queries.js    # Consultas logs
│   │   ├── user.queries.js    # Consultas usuarios
│   │   ├── event.queries.js
│   │   ├── resource.queries.js
│   │   ├── booking.queries.js
│   │   ├── catalog.queries.js
│   │   ├── university.queries.js
│   │   ├── request.queries.js
│   │   ├── notification.queries.js
│   │   ├── pqrs.queries.js
│   │   └── storage.queries.js
│   ├── templates/
│   │   ├── index.js           # Export templates
│   │   └── searchTemplates.js # Search templates
│   └── utils/
│       ├── index.js          # Export utils
│       ├── logger.js         # Logger enterprise
│       ├── errorHandler.js   # Manejo de errores
│       ├── indexHelper.js    # Helper de indexado
│       ├── bulkHelper.js     # Bulk processing
│       └── monitoring.js     # Métricas y monitoring
├── package.json
├── index.js
└── README.md
```

src/client.js (Enterprise):

```javascript
const { Client } = require('@elastic/elasticsearch');
const { CircuitBreaker } = require('opossum');
const { v4: uuidv4 } = require('uuid');

class ElasticsearchClient {
  constructor({
    host = 'elasticsearch',
    port = '9200',
    user = 'elastic',
    password = 'changeme',
    apiVersion = '8.12',
    maxRetries = 5,
    requestTimeout = 30000,
    circuitBreakerThreshold = 0.5,
    circuitBreakerResetTimeout = 30000,
    enableDebug = false,
  }) {
    this.config = { host, port, user, password, apiVersion };
    this.maxRetries = maxRetries;
    this.requestTimeout = requestTimeout;
    this.enableDebug = enableDebug;

    // Crear cliente
    this.client = new Client({
      node: `https://${host}:${port}`,
      auth: { username: user, password },
      apiVersion,
      maxRetries,
      requestTimeout,
      sniffOnStart: true,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        ca: process.env.ELASTICSEARCH_CA_CERT
          ? Buffer.from(process.env.ELASTICSEARCH_CA_CERT, 'base64')
          : undefined,
      },
    });

    // Circuit Breaker
    this.breaker = new CircuitBreaker(
      async (method, params, options) => {
        const requestId = uuidv4();

        if (this.enableDebug) {
          console.debug(`[ES] Request ${requestId}: ${method}`, params);
        }

        return await this.client[method](params, {
          ...options,
          id: requestId,
          ignore: [404], // No abrir circuito para 404
        });
      },
      {
        timeout: requestTimeout,
        errorThresholdPercentage: circuitBreakerThreshold,
        resetTimeout: circuitBreakerResetTimeout,
      },
    );

    // Métodos convenientes
    this.methods = [
      'search',
      'index',
      'get',
      'update',
      'delete',
      'bulk',
      'count',
      'exists',
      'info',
      'ping',
      'mget',
      'msearch',
      'refresh',
    ];

    this.setupMethods();
  }

  setupMethods() {
    for (const method of this.methods) {
      this[method] = async (params, options = {}) => {
        try {
          return await this.breaker.fire(method, params, options);
        } catch (error) {
          if (this.breaker.state === 'OPEN') {
            // Fallback: intentar conexión directa
            return await this.client[method](params, options);
          }
          throw this.enhanceError(error, method, params);
        }
      };
    }
  }

  enhanceError(error, method, params) {
    const enhancedError = new Error(error.message);
    enhancedError.name = error.name;
    enhancedError.statusCode = error.statusCode;
    enhancedError.method = method;
    enhancedError.params = params;
    enhancedError.timestamp = new Date().toISOString();
    enhancedError.requestId = uuidv4();

    // Mapear errores comunes
    if (error.statusCode === 404) {
      enhancedError.code = 'ES_INDEX_NOT_FOUND';
      enhancedError.message = `Índice no encontrado: ${params.index || params._index}`;
    } else if (error.statusCode === 400) {
      enhancedError.code = 'ES_BAD_REQUEST';
      enhancedError.message = `Solicitud inválida a Elasticsearch: ${error.message}`;
    } else if (error.statusCode === 429) {
      enhancedError.code = 'ES_TOO_MANY_REQUESTS';
      enhancedError.message = 'Demasiadas solicitudes a Elasticsearch';
    } else if (error.statusCode >= 500) {
      enhancedError.code = 'ES_SERVER_ERROR';
      enhancedError.message = `Error del servidor Elasticsearch: ${error.message}`;
    }

    return enhancedError;
  }

  async ping() {
    try {
      await this.info();
      return { healthy: true, status: 'up' };
    } catch (error) {
      return {
        healthy: false,
        status: 'down',
        error: error.message,
        code: error.statusCode,
      };
    }
  }

  async getClusterHealth() {
    try {
      const health = await this.cluster.health();
      return health.body;
    } catch (error) {
      return { status: 'unknown', error: error.message };
    }
  }

  async createIndex(index, body) {
    try {
      const exists = await this.indices.exists({ index });
      if (exists.body) {
        return { created: false, index };
      }

      await this.indices.create({ index, body });
      return { created: true, index };
    } catch (error) {
      if (error.statusCode === 400 && error.message.includes('already exists')) {
        return { created: false, index };
      }
      throw error;
    }
  }

  async indexExists(index) {
    try {
      const exists = await this.indices.exists({ index });
      return exists.body;
    } catch (error) {
      return false;
    }
  }

  getBreakerStats() {
    return {
      state: this.breaker.state,
      stats: this.breaker.stats,
    };
  }

  getClient() {
    return this.client;
  }

  close() {
    this.breaker.shutdown();
  }
}

const createElasticsearchClient = (config) => new ElasticsearchClient(config);

module.exports = { ElasticsearchClient, createElasticsearchClient };
```

src/mappings/index.js:

```javascript
const fs = require('fs');
const path = require('path');

// Cargar todos los mapeos
const mappings = {};
const mappingsDir = path.join(__dirname);

fs.readdirSync(mappingsDir)
  .filter(file => file.endsWith('.mapping.js') && file !== 'index.js')
  .forEach(file => {
    const name = file.replace('.mapping.js', '');
    mappings[name] = require(path.join(mappingsDir, file));
  });

// Mapeo para logs
mappings.logs = {
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    index.lifecycle.name: 'uajs_logs_policy',
    index.lifecycle.rollover_alias: 'uajs_logs'
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      '@timestamp': { type: 'date' },
      service: { type: 'keyword' },
      level: { type: 'keyword' },
      message: { type: 'text' },
      correlationId: { type: 'keyword' },
      requestId: { type: 'keyword' },
      userId: { type: 'keyword' },
      duration: { type: 'integer' },
      http: {
        properties: {
          method: { type: 'keyword' },
          path: { type: 'keyword' },
          statusCode: { type: 'integer' },
          duration: { type: 'integer' }
        }
      },
      error: {
        properties: {
          message: { type: 'text' },
          stack: { type: 'text' },
          name: { type: 'keyword' },
          code: { type: 'keyword' }
        }
      },
      metadata: { type: 'object', enabled: true }
    }
  }
};

// Mapeo genérico para entidades
const createEntityMapping = (entityName, properties = {}) => ({
  settings: {
    number_of_shards: 2,
    number_of_replicas: 1,
    index.lifecycle.name: 'uajs_business_policy'
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      estado: { type: 'keyword' },
      ...properties
    }
  }
});

// Exportar todo
module.exports = {
  ...mappings,
  createEntityMapping,
  getMapping: (name) => mappings[name] || createEntityMapping(name)
};
```

src/mappings/user.mapping.js:

```javascript
module.exports = {
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    index.lifecycle.name: 'uajs_business_policy'
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      id: { type: 'integer' },
      uuid: { type: 'keyword' },
      correo: {
        type: 'keyword',
        copy_to: ['search_text']
      },
      password: { type: 'keyword', index: false },
      id_tercero: { type: 'integer' },
      estado: { type: 'keyword' },
      roles: {
        type: 'keyword',
        copy_to: ['search_text']
      },
      permissions: { type: 'keyword' },
      remember_token: { type: 'keyword', index: false },
      email_verified_at: { type: 'date' },
      ultimo_acceso: { type: 'date' },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      search_text: { type: 'text' },
      // Para join con terceros
      tercero: {
        properties: {
          uuid: { type: 'keyword' },
          tipo_persona: { type: 'keyword' },
          primer_nombre: { type: 'text', copy_to: ['search_text'] },
          segundo_nombre: { type: 'text', copy_to: ['search_text'] },
          primer_apellido: { type: 'text', copy_to: ['search_text'] },
          segundo_apellido: { type: 'text', copy_to: ['search_text'] },
          numero_documento: { type: 'keyword' },
          tipo_documento: { type: 'keyword' }
        }
      }
    }
  }
};
```

src/queries/logs.queries.js:

```javascript
const { useSearchTemplate } = require('../templates/searchTemplates');

class LogsQueryBuilder {
  constructor(client) {
    this.client = client;
  }

  // Búsqueda básica de logs
  async search({
    service,
    level,
    message,
    requestId,
    userId,
    correlationId,
    dateFrom,
    dateTo,
    page = 1,
    size = 20,
    sortField = '@timestamp',
    sortOrder = 'desc',
  } = {}) {
    const must = [];
    const filter = [];

    if (service) {
      must.push({ term: { service } });
    }

    if (level) {
      must.push({ term: { level } });
    }

    if (message) {
      must.push({ match: { message } });
    }

    if (requestId) {
      filter.push({ term: { requestId } });
    }

    if (userId) {
      filter.push({ term: { userId } });
    }

    if (correlationId) {
      filter.push({ term: { correlationId } });
    }

    if (dateFrom || dateTo) {
      const range = {};
      if (dateFrom) range.gte = dateFrom;
      if (dateTo) range.lte = dateTo;
      filter.push({ range: { '@timestamp': range } });
    }

    const query = {
      bool: {
        must,
        filter,
      },
    };

    const result = await this.client.search({
      index: 'uajs_logs-*',
      body: {
        query,
        from: (page - 1) * size,
        size,
        sort: [{ [sortField]: { order: sortOrder } }],
        track_total_hits: true,
      },
    });

    return this.formatResponse(result);
  }

  // Búsqueda por servicio y nivel
  async searchByServiceAndLevel(service, level, { page = 1, size = 20 } = {}) {
    const result = await this.client.search({
      index: 'uajs_logs-*',
      body: {
        query: {
          bool: {
            must: [{ term: { service } }, { term: { level } }],
          },
        },
        from: (page - 1) * size,
        size,
        sort: [{ '@timestamp': { order: 'desc' } }],
      },
    });

    return this.formatResponse(result);
  }

  // Contar logs por servicio
  async countByService() {
    const result = await this.client.search({
      index: 'uajs_logs-*',
      body: {
        size: 0,
        aggs: {
          services: {
            terms: { field: 'service', size: 100 },
          },
        },
      },
    });

    return result.body.aggregations?.services?.buckets || [];
  }

  // Contar logs por nivel
  async countByLevel() {
    const result = await this.client.search({
      index: 'uajs_logs-*',
      body: {
        size: 0,
        aggs: {
          levels: {
            terms: { field: 'level', size: 10 },
          },
        },
      },
    });

    return result.body.aggregations?.levels?.buckets || [];
  }

  // Contar logs por código HTTP
  async countByHttpStatus() {
    const result = await this.client.search({
      index: 'uajs_logs-*',
      body: {
        size: 0,
        aggs: {
          status_codes: {
            terms: {
              field: 'http.statusCode',
              size: 100,
            },
          },
        },
      },
    });

    return result.body.aggregations?.status_codes?.buckets || [];
  }

  // Búsqueda de errores
  async searchErrors({ service, limit = 100, hours = 24 } = {}) {
    const dateFrom = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const must = [{ term: { level: 'error' } }];
    if (service) {
      must.push({ term: { service } });
    }

    const result = await this.client.search({
      index: 'uajs_logs-*',
      body: {
        query: { bool: { must } },
        from: 0,
        size: limit,
        sort: [{ '@timestamp': { order: 'desc' } }],
        _source: ['@timestamp', 'service', 'message', 'error', 'requestId'],
      },
    });

    return this.formatResponse(result);
  }

  // Formatear respuesta
  formatResponse(result) {
    return {
      total: result.body.hits.total?.value || 0,
      hits: result.body.hits.hits.map((hit) => ({
        id: hit._id,
        index: hit._index,
        score: hit._score,
        source: hit._source,
      })),
      took: result.body.took,
      timed_out: result.body.timed_out,
    };
  }
}

module.exports = LogsQueryBuilder;
```

src/queries/user.queries.js:

```javascript
class UserQueryBuilder {
  constructor(client) {
    this.client = client;
  }

  // Búsqueda básica
  async search({
    query,
    correo,
    estado,
    rol,
    page = 1,
    size = 20,
    sortField = 'createdAt',
    sortOrder = 'desc',
  } = {}) {
    const must = [];
    const filter = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['correo^2', 'tercero.primer_nombre', 'tercero.primer_apellido', 'search_text'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (correo) {
      must.push({ term: { correo } });
    }

    if (estado) {
      filter.push({ term: { estado } });
    }

    if (rol) {
      filter.push({ term: { roles: rol } });
    }

    const result = await this.client.search({
      index: 'uajs_users',
      body: {
        query: { bool: { must, filter } },
        from: (page - 1) * size,
        size,
        sort: [{ [sortField]: { order: sortOrder } }],
        track_total_hits: true,
      },
    });

    return this.formatResponse(result);
  }

  // Obtener por UUID
  async getByUuid(uuid) {
    try {
      const result = await this.client.get({
        index: 'uajs_users',
        id: uuid,
      });
      return { found: true, ...result.body };
    } catch (error) {
      if (error.statusCode === 404) {
        return { found: false };
      }
      throw error;
    }
  }

  // Obtener por correo
  async getByCorreo(correo) {
    const result = await this.client.search({
      index: 'uajs_users',
      body: {
        query: { term: { correo } },
        size: 1,
      },
    });

    if (result.body.hits.hits.length === 0) {
      return { found: false };
    }

    return { found: true, ...result.body.hits.hits[0] };
  }

  // Búsqueda paginada con scroll para grandes resultsets
  async searchWithScroll({ query, pageSize = 1000, scrollTime = '1m' } = {}) {
    const results = [];
    let scrollId = null;
    let hasMore = true;

    while (hasMore) {
      const result = await this.client.search({
        index: 'uajs_users',
        body: {
          query,
          size: pageSize,
        },
        scroll: scrollTime,
        scroll_id: scrollId,
      });

      results.push(...result.body.hits.hits);
      scrollId = result.body._scroll_id;
      hasMore = result.body.hits.hits.length > 0;
    }

    // Limpiar scroll
    if (scrollId) {
      await this.client.clearScroll({ scroll_id: [scrollId] });
    }

    return results;
  }

  // Aggregaciones
  async getStats() {
    const result = await this.client.search({
      index: 'uajs_users',
      body: {
        size: 0,
        aggs: {
          by_estado: { terms: { field: 'estado', size: 10 } },
          by_rol: { terms: { field: 'roles', size: 10 } },
          created_over_time: {
            date_histogram: {
              field: 'createdAt',
              calendar_interval: 'month',
            },
          },
        },
      },
    });

    return result.body.aggregations;
  }

  // Suggest
  async suggestCorreo(prefix) {
    const result = await this.client.search({
      index: 'uajs_users',
      body: {
        suggest: {
          correo_suggestions: {
            prefix,
            completion: {
              field: 'correo',
            },
          },
        },
      },
    });

    return result.body.suggest?.correo_suggestions?.[0]?.options || [];
  }

  formatResponse(result) {
    return {
      total: result.body.hits.total?.value || 0,
      hits: result.body.hits.hits.map((hit) => ({
        id: hit._id,
        index: hit._index,
        score: hit._score,
        source: hit._source,
      })),
      took: result.body.took,
    };
  }
}

module.exports = UserQueryBuilder;
```

src/templates/searchTemplates.js:

```javascript
const registerSearchTemplates = async (client) => {
  const templates = [
    // Template para búsqueda paginada
    {
      name: 'uajs_paginated_search',
      body: {
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    { match: { ${{query_field}}: ${{query_value}} } }
                  ],
                  minimum_should_match: 1
                }
              }
            ],
            filter: [
              ${{filters}}
            ]
          }
        },
        from: ${{from}},
        size: ${{size}},
        sort: [
          { ${{sort_field}}: { order: ${{sort_order}} } }
        ],
        aggs: ${{aggregations}},
        track_total_hits: true,
        _source: ${{source_fields}}
      }
    },

    // Template para búsqueda por fecha
    {
      name: 'uajs_date_range_search',
      body: {
        query: {
          bool: {
            must: [
              {
                range: {
                  ${{date_field}}: {
                    gte: ${{date_from}},
                    lte: ${{date_to}},
                    format: 'strict_date_optional_time'
                  }
                }
              }
            ],
            filter: [
              ${{filters}}
            ]
          }
        },
        from: ${{from}},
        size: ${{size}},
        sort: [
          { ${{date_field}}: { order: ${{sort_order}} } }
        ],
        aggs: ${{aggregations}}
      }
    },

    // Template para búsqueda full-text
    {
      name: 'uajs_full_text_search',
      body: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: ${{query}},
                  fields: ${{fields}},
                  fuzziness: ${{fuzziness}},
                  operator: ${{operator}},
                  type: 'best_fields'
                }
              }
            ],
            filter: [
              ${{filters}}
            ]
          }
        },
        highlight: {
          fields: ${{fields}},
          pre_tags: ['<em>'],
          post_tags: ['</em>'],
          number_of_fragments: 3
        },
        from: ${{from}},
        size: ${{size}},
        sort: [
          { _score: { order: 'desc' } }
        ]
      }
    },

    // Template para aggregaciones
    {
      name: 'uajs_aggregation_search',
      body: {
        query: ${{query}},
        aggs: ${{aggregations}},
        size: 0,
        track_total_hits: true
      }
    },

    // Template para búsqueda geoespacial
    {
      name: 'uajs_geo_search',
      body: {
        query: {
          bool: {
            filter: [
              {
                geo_distance: {
                  distance: ${{distance}},
                  ${{geo_field}}: {
                    lat: ${{lat}},
                    lon: ${{lon}}
                  }
                }
              }
            ]
          }
        },
        from: ${{from}},
        size: ${{size}},
        sort: [
          { _geo_distance: {
            ${{geo_field}}: { lat: ${{lat}}, lon: ${{lon}} },
            order: 'asc',
            unit: 'km'
          } }
        ]
      }
    }
  ];

  for (const template of templates) {
    try {
      await client.putScript({
        id: template.name,
        body: template.body
      });
      console.log(`✅ Search template registrado: ${template.name}`);
    } catch (error) {
      if (error.statusCode === 400 && error.message.includes('already exists')) {
        console.log(`ℹ️  Search template ya existe: ${template.name}`);
      } else {
        console.error(`❌ Error registrando template ${template.name}:`, error.message);
      }
    }
  }
};

const useSearchTemplate = (client, templateName, params) => {
  return client.searchTemplate({
    body: {
      id: templateName,
      params
    }
  });
};

// Templates específicos por servicio
const serviceTemplates = {
  user_search: {
    name: 'uajs_user_search',
    body: {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: '${{query}}',
                fields: ['correo^2', 'tercero.primer_nombre', 'tercero.primer_apellido', 'search_text'],
                fuzziness: 'AUTO'
              }
            }
          ],
          filter: [
            ${{filters}}
          ]
        }
      },
      from: ${{from}},
      size: ${{size}},
      sort: [
        { ${{sort_field}}: { order: '${{sort_order}}' } }
      ]
    }
  },

  log_search: {
    name: 'uajs_log_search',
    body: {
      query: {
        bool: {
          must: [
            ${{query_clause}}
          ],
          filter: [
            { range: { '@timestamp': { gte: '${{date_from}}', lte: '${{date_to}}' } } },
            ${{filters}}
          ]
        }
      },
      from: ${{from}},
      size: ${{size}},
      sort: [
        { '@timestamp': { order: '${{sort_order}}' } }
      ],
      aggs: ${{aggregations}}
    }
  }
};

const registerServiceTemplates = async (client) => {
  for (const [name, template] of Object.entries(serviceTemplates)) {
    try {
      await client.putScript({
        id: template.name,
        body: template.body
      });
      console.log(`✅ Service template registrado: ${template.name}`);
    } catch (error) {
      if (error.statusCode === 400 && error.message.includes('already exists')) {
        console.log(`ℹ️  Service template ya existe: ${template.name}`);
      }
    }
  }
};

module.exports = {
  registerSearchTemplates,
  useSearchTemplate,
  registerServiceTemplates,
  serviceTemplates
};
```

src/utils/logger.js (Enterprise):

```javascript
const { v4: uuidv4 } = require('uuid');

class ElasticsearchLogger {
  constructor(
    client,
    {
      serviceName = 'unknown',
      indexPrefix = 'uajs_logs',
      flushInterval = 5000,
      batchSize = 500,
      maxQueueSize = 10000,
      enableConsoleFallback = true,
    } = {},
  ) {
    this.client = client;
    this.serviceName = serviceName;
    this.indexPrefix = indexPrefix;
    this.flushInterval = flushInterval;
    this.batchSize = batchSize;
    this.maxQueueSize = maxQueueSize;
    this.enableConsoleFallback = enableConsoleFallback;

    this.queue = [];
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      dropped: 0,
    };

    this.flushTimeout = null;
    this.startFlusher();
  }

  startFlusher() {
    this.flushTimeout = setInterval(() => {
      if (this.queue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  stopFlusher() {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
    }
    this.flush();
  }

  addToQueue(logEntry) {
    if (this.queue.length >= this.maxQueueSize) {
      // Drop oldest log if queue is full
      this.queue.shift();
      this.stats.dropped++;
    }

    this.queue.push(logEntry);
    this.stats.total++;
  }

  async flush() {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);
    const bulkBody = batch.flatMap((log) => [
      {
        index: {
          _index: `${this.indexPrefix}-${log.timestamp.split('T')[0]}`,
        },
      },
      log,
    ]);

    try {
      const response = await this.client.bulk({
        body: bulkBody,
        refresh: false,
      });

      if (response.body.errors) {
        const failed = response.body.items.filter((item) => item.index?.status >= 400);
        this.stats.failed += failed.length;
        this.stats.success += batch.length - failed.length;

        if (this.enableConsoleFallback) {
          failed.forEach((item) => {
            const log = batch[item.index];
            console.error(`[FALLBACK] ${log.level}: ${log.message}`, log);
          });
        }
      } else {
        this.stats.success += batch.length;
      }
    } catch (error) {
      this.stats.failed += batch.length;

      if (this.enableConsoleFallback) {
        batch.forEach((log) => {
          console.error(`[FALLBACK] ${log.level}: ${log.message}`, log);
        });
      }
    }
  }

  log({
    level = 'info',
    message,
    correlationId,
    requestId,
    userId,
    metadata = {},
    timestamp = new Date().toISOString(),
  } = {}) {
    const logEntry = {
      '@timestamp': timestamp,
      service: this.serviceName,
      level,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      ...(correlationId && { correlationId }),
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...metadata,
    };

    this.addToQueue(logEntry);
    return correlationId || uuidv4();
  }

  error(error, { correlationId, requestId, userId, metadata = {} } = {}) {
    const errorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error.code && { code: error.code }),
      ...(error.statusCode && { statusCode: error.statusCode }),
      ...(error.cause && { cause: error.cause.message }),
    };

    return this.log({
      level: 'error',
      message: error.message,
      error: errorInfo,
      correlationId,
      requestId,
      userId,
      metadata,
    });
  }

  warn(message, context = {}) {
    return this.log({ level: 'warn', message, ...context });
  }

  info(message, context = {}) {
    return this.log({ level: 'info', message, ...context });
  }

  debug(message, context = {}) {
    return this.log({ level: 'debug', message, ...context });
  }

  http({ method, path, statusCode, duration, requestId, userId, correlationId, ip, userAgent }) {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    return this.log({
      level,
      message: `${method} ${path} ${statusCode}`,
      http: {
        method,
        path,
        statusCode,
        duration,
        ...(ip && { ip }),
        ...(userAgent && { userAgent }),
      },
      requestId,
      userId,
      correlationId,
    });
  }

  // Métricas de logging
  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      dropped: 0,
    };
  }
}

module.exports = ElasticsearchLogger;
```

src/utils/bulkHelper.js (Enterprise):

```javascript
class BulkProcessor {
  constructor(
    client,
    {
      batchSize = 1000,
      flushInterval = 5000,
      maxRetries = 3,
      concurrentBatches = 2,
      onProgress,
      onError,
      onComplete,
    } = {},
  ) {
    this.client = client;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.maxRetries = maxRetries;
    this.concurrentBatches = Math.min(concurrentBatches, 5);
    this.onProgress = onProgress;
    this.onError = onError;
    this.onComplete = onComplete;

    this.queue = [];
    this.processing = 0;
    this.stats = {
      total: 0,
      processed: 0,
      failed: 0,
      retries: 0,
      startTime: null,
      endTime: null,
    };

    this.flushTimeout = null;
    this.startFlusher();
  }

  startFlusher() {
    this.flushTimeout = setInterval(() => {
      if (this.queue.length > 0 && this.processing < this.concurrentBatches) {
        this.processBatch();
      }
    }, this.flushInterval);
  }

  stopFlusher() {
    if (this.flushTimeout) {
      clearInterval(this.flushTimeout);
    }
  }

  add(index, id, document) {
    this.queue.push({ index, id, document });
    this.stats.total++;

    if (this.queue.length >= this.batchSize) {
      this.processBatch();
    }

    if (this.onProgress) {
      this.onProgress(this.stats);
    }
  }

  addMany(documents, getIndex, getId) {
    const batch = documents.map((doc) => ({
      index: getIndex(doc),
      id: getId(doc),
      document: doc,
    }));

    this.queue.push(...batch);
    this.stats.total += batch.length;

    if (this.queue.length >= this.batchSize) {
      this.processBatch();
    }

    if (this.onProgress) {
      this.onProgress(this.stats);
    }
  }

  async processBatch() {
    if (this.queue.length === 0 || this.processing >= this.concurrentBatches) {
      return;
    }

    this.processing++;
    const batch = this.queue.splice(0, this.batchSize);

    const bulkBody = batch.flatMap(({ index, id, document }) => [
      { index: { _index: index, _id: id } },
      document,
    ]);

    let retryCount = 0;
    let success = false;

    while (retryCount <= this.maxRetries && !success) {
      try {
        const response = await this.client.bulk({
          body: bulkBody,
          refresh: false,
        });

        if (response.body.errors) {
          const failed = response.body.items.filter((item) => item.index?.status >= 400);
          this.stats.failed += failed.length;
          this.stats.processed += batch.length - failed.length;

          if (retryCount < this.maxRetries) {
            // Reintentar solo los fallidos
            const failedBatch = failed.map((f) => batch[f.index]);
            this.queue.unshift(...failedBatch);
            retryCount++;
            this.stats.retries += failed.length;
            continue;
          }
        } else {
          this.stats.processed += batch.length;
        }

        success = true;
      } catch (error) {
        retryCount++;
        this.stats.retries += batch.length;

        if (retryCount > this.maxRetries) {
          this.stats.failed += batch.length;
          if (this.onError) {
            this.onError(error, batch);
          }
        }

        // Esperar antes de reintentar
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.processing--;

    // Procesar siguiente batch
    if (this.queue.length > 0) {
      this.processBatch();
    }
  }

  async processIterator(iterator, getIndex, getId) {
    this.stats.startTime = Date.now();

    for await (const doc of iterator) {
      this.add(getIndex(doc), getId(doc), doc);
    }

    // Esperar a que se procesen todos
    while (this.queue.length > 0 || this.processing > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.stats.endTime = Date.now();

    if (this.onComplete) {
      this.onComplete(this.stats);
    }

    return this.stats;
  }

  async waitForCompletion() {
    while (this.queue.length > 0 || this.processing > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return this.stats;
  }

  getStats() {
    const stats = { ...this.stats };

    if (stats.startTime && stats.endTime) {
      stats.duration = stats.endTime - stats.startTime;
      stats.opsPerSecond = stats.processed / (stats.duration / 1000);
    }

    return stats;
  }

  resetStats() {
    this.stats = {
      total: 0,
      processed: 0,
      failed: 0,
      retries: 0,
      startTime: null,
      endTime: null,
    };
  }

  stop() {
    this.stopFlusher();
    return this.waitForCompletion();
  }
}

module.exports = BulkProcessor;
```

src/utils/monitoring.js (Enterprise):

```javascript
const collectMetrics = (client) => {
  return {
    // Métricas de cluster
    cluster: {
      health: async () => {
        const health = await client.cluster.health();
        return {
          status: health.body.status,
          nodes: health.body.number_of_nodes,
          dataNodes: health.body.number_of_data_nodes,
          shards: health.body.active_shards,
          unassignedShards: health.body.unassigned_shards,
          activePrimaryShards: health.body.active_primary_shards,
          relocatingShards: health.body.relocating_shards,
          initializingShards: health.body.initializing_shards,
        };
      },

      stats: async () => {
        const stats = await client.cluster.stats();
        return {
          nodes: stats.body.nodes,
          fs: stats.body.fs,
          process: stats.body.process,
          jvm: stats.body.jvm,
          threadPools: stats.body.thread_pool,
        };
      },

      pendingTasks: async () => {
        const tasks = await client.cluster.pendingTasks();
        return tasks.body.tasks || [];
      },
    },

    // Métricas de índices
    indices: {
      stats: async (indexPattern = '*') => {
        const stats = await client.indices.stats({ index: indexPattern });
        const indices = Object.keys(stats.body.indices);

        return indices.map((index) => ({
          index,
          docs: stats.body.indices[index].total.docs.count,
          deletedDocs: stats.body.indices[index].total.docs.deleted,
          size: stats.body.indices[index].total.store.size_in_bytes,
          primarySize: stats.body.indices[index].primaries.store.size_in_bytes,
          queryTime: stats.body.indices[index].total.search.query_time_in_millis,
          queryCount: stats.body.indices[index].total.search.query_total,
          indexTime: stats.body.indices[index].total.indexing.index_time_in_millis,
          indexCount: stats.body.indices[index].total.indexing.index_total,
          getTime: stats.body.indices[index].total.get.time_in_millis,
          getCount: stats.body.indices[index].total.get.total,
          refreshTime: stats.body.indices[index].total.refresh.time_in_millis,
          refreshCount: stats.body.indices[index].total.refresh.total,
        }));
      },

      recovery: async () => {
        const recovery = await client.indices.recovery();
        return recovery.body;
      },

      segments: async () => {
        const segments = await client.indices.segments();
        return segments.body;
      },
    },

    // Métricas de nodos
    nodes: {
      stats: async () => {
        const stats = await client.nodes.stats();
        return Object.values(stats.body.nodes).map((node) => ({
          name: node.name,
          host: node.host,
          ip: node.ip,
          version: node.version,
          roles: node.roles,

          // CPU
          cpu: {
            percent: node.process.cpu.percent,
            loadAverage: node.process.cpu.load_average,
          },

          // Memoria
          memory: {
            total: node.process.mem.total_in_bytes,
            used: node.process.mem.total_in_bytes - node.process.mem.free_in_bytes,
            free: node.process.mem.free_in_bytes,
            percent: (1 - node.process.mem.free_in_bytes / node.process.mem.total_in_bytes) * 100,
          },

          // JVM
          jvm: {
            heap: {
              used: node.jvm.mem.heap_used_in_bytes,
              max: node.jvm.mem.heap_max_in_bytes,
              percent: node.jvm.mem.heap_used_percent,
            },
            nonHeap: {
              used: node.jvm.mem.non_heap_used_in_bytes,
              max: node.jvm.mem.non_heap_committed_in_bytes,
            },
            gc: node.jvm.gc,
          },

          // Almacenamiento
          fs: {
            total: node.fs.total.total_in_bytes,
            used: node.fs.total.total_in_bytes - node.fs.total.free_in_bytes,
            free: node.fs.total.free_in_bytes,
            percent: node.fs.total.used_percent,
          },

          // Thread Pools
          threadPools: Object.entries(node.thread_pool).reduce((acc, [name, pool]) => {
            acc[name] = {
              threads: pool.threads,
              queue: pool.queue,
              active: pool.active,
              rejected: pool.rejected,
              largest: pool.largest,
              completed: pool.completed,
            };
            return acc;
          }, {}),

          // Network
          network: node.transport,

          // Uptime
          uptime: node.process.uptime_in_millis,
        }));
      },

      info: async () => {
        const info = await client.nodes.info();
        return Object.values(info.body.nodes).map((node) => ({
          name: node.name,
          version: node.version,
          buildHash: node.build_hash,
          buildDate: node.build_date,
          os: node.os,
          process: node.process,
          jvm: node.jvm,
        }));
      },
    },

    // Métricas de consultas
    search: {
      slowLogs: async (indexPattern = '*') => {
        const slowLogs = await client.search({
          index: '.search-slow-*',
          body: {
            query: { match_all: {} },
            sort: [{ '@timestamp': { order: 'desc' } }],
            size: 100,
          },
        });
        return slowLogs.body.hits.hits;
      },
    },

    // Métricas de bulk
    bulk: {
      stats: async () => {
        const stats = await client.nodes.stats({ metric: 'bulk' });
        return Object.values(stats.body.nodes).map((node) => ({
          name: node.name,
          bulk: node.thread_pool.bulk,
        }));
      },
    },
  };
};

// Middleware para exponer métricas en formato Prometheus
const prometheusMiddleware = (client) => {
  const metrics = collectMetrics(client);

  return async (req, res, next) => {
    if (req.path === '/metrics/es') {
      try {
        const [health, clusterStats, nodesStats, indicesStats] = await Promise.all([
          metrics.cluster.health(),
          metrics.cluster.stats(),
          metrics.nodes.stats(),
          metrics.indices.stats(),
        ]);

        const prometheusMetrics = [];

        // Métricas de cluster
        prometheusMetrics.push(
          `# HELP uajs_es_cluster_health_status Estado del cluster Elasticsearch`,
          `# TYPE uajs_es_cluster_health_status gauge`,
          `uajs_es_cluster_health_status{status="${health.status}"} 1`,
        );

        prometheusMetrics.push(
          `# HELP uajs_es_cluster_nodes_total Número total de nodos`,
          `# TYPE uajs_es_cluster_nodes_total gauge`,
          `uajs_es_cluster_nodes_total ${health.nodes}`,
        );

        prometheusMetrics.push(
          `# HELP uajs_es_cluster_shards_total Número total de shards`,
          `# TYPE uajs_es_cluster_shards_total gauge`,
          `uajs_es_cluster_shards_total ${health.shards}`,
        );

        // Métricas de nodos
        nodesStats.forEach((node) => {
          prometheusMetrics.push(
            `# HELP uajs_es_node_cpu_usage Uso de CPU por nodo`,
            `# TYPE uajs_es_node_cpu_usage gauge`,
            `uajs_es_node_cpu_usage{node="${node.name}"} ${node.cpu.percent}`,
          );

          prometheusMetrics.push(
            `# HELP uajs_es_node_memory_usage Uso de memoria por nodo`,
            `# TYPE uajs_es_node_memory_usage gauge`,
            `uajs_es_node_memory_usage{node="${node.name}"} ${node.memory.percent}`,
          );

          prometheusMetrics.push(
            `# HELP uajs_es_node_jvm_heap_usage Uso de heap JVM por nodo`,
            `# TYPE uajs_es_node_jvm_heap_usage gauge`,
            `uajs_es_node_jvm_heap_usage{node="${node.name}"} ${node.jvm.heap.percent}`,
          );

          prometheusMetrics.push(
            `# HELP uajs_es_node_fs_usage Uso de almacenamiento por nodo`,
            `# TYPE uajs_es_node_fs_usage gauge`,
            `uajs_es_node_fs_usage{node="${node.name}"} ${node.fs.percent}`,
          );
        });

        // Métricas de índices
        indicesStats.forEach((index) => {
          prometheusMetrics.push(
            `# HELP uajs_es_index_docs_total Documentos por índice`,
            `# TYPE uajs_es_index_docs_total gauge`,
            `uajs_es_index_docs_total{index="${index.index}"} ${index.docs}`,
          );

          prometheusMetrics.push(
            `# HELP uajs_es_index_size_bytes Tamaño por índice`,
            `# TYPE uajs_es_index_size_bytes gauge`,
            `uajs_es_index_size_bytes{index="${index.index}"} ${index.size}`,
          );
        });

        res.set('Content-Type', 'text/plain');
        res.send(prometheusMetrics.join('\n') + '\n');
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
      return;
    }
    next();
  };
};

// Health check middleware
const healthCheckMiddleware = (client) => {
  return async (req, res, next) => {
    if (req.path === '/health/es') {
      try {
        const health = await client.cluster.health();
        const status = health.body.status;

        const response = {
          success: status === 'green' || status === 'yellow',
          code: status === 'green' ? 'OK' : status === 'yellow' ? 'DEGRADED' : 'UNHEALTHY',
          message: status,
          data: {
            status,
            nodes: health.body.number_of_nodes,
            shards: health.body.active_shards,
            unassignedShards: health.body.unassigned_shards,
          },
        };

        const httpStatus = status === 'green' ? 200 : status === 'yellow' ? 200 : 503;
        res.status(httpStatus).json(response);
      } catch (error) {
        res.status(503).json({
          success: false,
          code: 'ES_UNAVAILABLE',
          message: 'Elasticsearch no disponible',
          error: error.message,
        });
      }
      return;
    }
    next();
  };
};

module.exports = {
  collectMetrics,
  prometheusMiddleware,
  healthCheckMiddleware,
};
```

src/utils/indexHelper.js (Enterprise):

```javascript
class IndexHelper {
  constructor(client) {
    this.client = client;
  }

  // Indexar documento
  async index(index, id, document, { refresh = false, retryOnConflict = 3, version = null } = {}) {
    let retries = 0;

    while (retries <= retryOnConflict) {
      try {
        const response = await this.client.index({
          index,
          id,
          body: document,
          refresh,
          ...(version && { version }),
        });

        return response.body;
      } catch (error) {
        if (error.statusCode === 409 && retries < retryOnConflict) {
          // Conflict: document already exists
          retries++;
          const delay = Math.pow(2, retries) * 100;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }

  // Indexar con upsert
  async indexWithUpsert(index, id, document, script) {
    try {
      const response = await this.client.update({
        index,
        id,
        body: {
          doc: document,
          doc_as_upsert: true,
          ...(script && { script }),
        },
        refresh: true,
      });

      return response.body;
    } catch (error) {
      if (error.statusCode === 404) {
        // Documento no existe, crear
        return this.index(index, id, document, { refresh: true });
      }
      throw error;
    }
  }

  // Obtener documento
  async get(index, id, { source = true } = {}) {
    try {
      const response = await this.client.get({
        index,
        id,
        _source: source,
      });
      return response.body;
    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // Actualizar documento
  async update(index, id, document, { retryOnConflict = 3, refresh = false } = {}) {
    let retries = 0;

    while (retries <= retryOnConflict) {
      try {
        const response = await this.client.update({
          index,
          id,
          body: { doc: document },
          refresh,
        });

        return response.body;
      } catch (error) {
        if (error.statusCode === 409 && retries < retryOnConflict) {
          retries++;
          const delay = Math.pow(2, retries) * 100;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }

  // Actualizar parcial
  async updatePartial(index, id, partialDoc, { refresh = false } = {}) {
    try {
      const response = await this.client.update({
        index,
        id,
        body: { doc: partialDoc },
        refresh,
      });
      return response.body;
    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // Eliminar documento
  async delete(index, id, { refresh = false } = {}) {
    try {
      const response = await this.client.delete({
        index,
        id,
        refresh,
      });
      return response.body;
    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // Verificar existencia
  async exists(index, id) {
    try {
      const response = await this.client.exists({
        index,
        id,
      });
      return response.body;
    } catch (error) {
      return false;
    }
  }

  // Bulk con retry
  async bulk(operations, { batchSize = 1000, maxRetries = 3, refresh = false } = {}) {
    const results = [];

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      let retries = 0;
      let success = false;

      while (retries <= maxRetries && !success) {
        try {
          const response = await this.client.bulk({
            body: batch,
            refresh,
          });

          if (response.body.errors) {
            const failed = response.body.items.filter((item) => item.index?.status >= 400);
            results.push(
              ...response.body.items.filter(
                (item) => !item.index?.status || item.index.status < 400,
              ),
            );

            if (retries < maxRetries) {
              retries++;
              continue;
            }

            results.push(...failed);
          } else {
            results.push(...response.body.items);
          }

          success = true;
        } catch (error) {
          retries++;
          if (retries > maxRetries) {
            throw error;
          }
          const delay = Math.pow(2, retries) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return results;
  }

  // Scroll para grandes resultsets
  async *scroll(index, query, { size = 1000, scrollTime = '1m' } = {}) {
    let scrollId = null;
    let hasMore = true;

    while (hasMore) {
      const response = await this.client.search({
        index,
        body: query,
        size,
        scroll: scrollTime,
        scroll_id: scrollId,
      });

      scrollId = response.body._scroll_id;
      const hits = response.body.hits.hits;

      for (const hit of hits) {
        yield hit;
      }

      hasMore = hits.length > 0;

      if (!hasMore && scrollId) {
        await this.client.clearScroll({ scroll_id: [scrollId] });
      }
    }
  }

  // Reindexar
  async reindex(sourceIndex, destIndex, query = { match_all: {} }) {
    const response = await this.client.reindex({
      body: {
        source: { index: sourceIndex, query },
        dest: { index: destIndex },
      },
      waitForCompletion: true,
    });

    return response.body;
  }

  // Crear índice con settings
  async createIndex(index, body) {
    try {
      const response = await this.client.indices.create({
        index,
        body,
      });
      return response.body;
    } catch (error) {
      if (error.statusCode === 400 && error.message.includes('already exists')) {
        return { acknowledged: false, index };
      }
      throw error;
    }
  }

  // Eliminar índice
  async deleteIndex(index) {
    try {
      const response = await this.client.indices.delete({
        index,
      });
      return response.body;
    } catch (error) {
      if (error.statusCode === 404) {
        return { acknowledged: false };
      }
      throw error;
    }
  }

  // Verificar índice
  async indexExists(index) {
    try {
      const response = await this.client.indices.exists({
        index,
      });
      return response.body;
    } catch (error) {
      return false;
    }
  }

  // Refresh índice
  async refresh(index) {
    try {
      const response = await this.client.indices.refresh({
        index,
      });
      return response.body;
    } catch (error) {
      throw error;
    }
  }

  // Alias
  async addAlias(index, alias) {
    try {
      const response = await this.client.indices.putAlias({
        index,
        name: alias,
      });
      return response.body;
    } catch (error) {
      if (error.statusCode === 400 && error.message.includes('already exists')) {
        return { acknowledged: false };
      }
      throw error;
    }
  }

  // Stats
  async getStats(index) {
    try {
      const response = await this.client.indices.stats({
        index,
      });
      return response.body;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = IndexHelper;
```

src/ilm/index.js (Enterprise):

```javascript
const createILMPolicy = async (client, {
  name,
  hotPhase,
  warmPhase,
  coldPhase,
  deletePhase
} = {}) => {
  const policy = {
    policy: {}
  };

  if (hotPhase) {
    policy.policy.hot = hotPhase;
  }

  if (warmPhase) {
    policy.policy.warm = warmPhase;
  }

  if (coldPhase) {
    policy.policy.cold = coldPhase;
  }

  if (deletePhase) {
    policy.policy.delete = deletePhase;
  }

  try {
    await client.ilm.putLifecycle({
      name,
      body: policy
    });
    return { created: true, name };
  } catch (error) {
    if (error.statusCode === 400 && error.message.includes('already exists')) {
      return { created: false, name };
    }
    throw error;
  }
};

const createIndexWithILM = async (client, index, mapping, ilmPolicyName) => {
  // Crear política ILM si no existe
  const policyExists = await client.ilm.getLifecycle({ name: ilmPolicyName }).catch(() => false);

  if (!policyExists) {
    await createILMPolicy(client, {
      name: ilmPolicyName,
      hotPhase: {
        min_age: '0ms',
        actions: {
          rollover: {
            max_size: '50GB',
            max_age: '30d'
          },
          set_priority: {
            priority: 100
          }
        }
      },
      deletePhase: {
        min_age: '365d',
        actions: {
          delete: {}
        }
      }
    });
  }

  // Crear índice con política ILM
  const indexName = `${index}-000001`;

  await client.indices.create({
    index: indexName,
    body: {
      settings: {
        index.lifecycle.name: ilmPolicyName,
        index.lifecycle.rollover_alias: index,
        number_of_shards: 2,
        number_of_replicas: 1
      },
      mappings: mapping
    }
  });

  // Crear alias
  await client.indices.putAlias({
    index: indexName,
    name: index
  });

  return { created: true, index: indexName, alias: index };
};

const applyILMPolicyToIndex = async (client, index, ilmPolicyName) => {
  await client.indices.putSettings({
    index,
    body: {
      index: {
        lifecycle: {
          name: ilmPolicyName
        }
      }
    }
  });
};

const getILMPolicy = async (client, name) => {
  try {
    const policy = await client.ilm.getLifecycle({ name });
    return policy.body;
  } catch (error) {
    return null;
  }
};

const listILMPolicies = async (client) => {
  try {
    const policies = await client.ilm.getLifecycle();
    return Object.keys(policies.body);
  } catch (error) {
    return [];
  }
};

const deleteILMPolicy = async (client, name) => {
  try {
    await client.ilm.deleteLifecycle({ name });
    return { deleted: true, name };
  } catch (error) {
    if (error.statusCode === 404) {
      return { deleted: false, name };
    }
    throw error;
  }
};

module.exports = {
  createILMPolicy,
  createIndexWithILM,
  applyILMPolicyToIndex,
  getILMPolicy,
  listILMPolicies,
  deleteILMPolicy
};
```

package.json:

```json
{
  "name": "@uajs/shared-elasticsearch",
  "version": "1.0.0",
  "description": "Paquete compartido para Elasticsearch en UAJS Smart Campus",
  "main": "index.js",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.js",
    "lint:fix": "eslint src/**/*.js --fix"
  },
  "dependencies": {
    "@elastic/elasticsearch": "^8.12.0",
    "opossum": "^6.7.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.12"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "keywords": ["elasticsearch", "logging", "search", "uajs"],
  "author": "UAJS Smart Campus",
  "license": "MIT"
}
```

index.js:

```javascript
// Re-exportar todo
module.exports = {
  // Client
  ElasticsearchClient: require('./src/client').ElasticsearchClient,
  createElasticsearchClient: require('./src/client').createElasticsearchClient,

  // Mappings
  ...require('./src/mappings'),
  mappings: require('./src/mappings'),

  // Queries
  queries: {
    logs: require('./src/queries/logs.queries'),
    user: require('./src/queries/user.queries'),
    event: require('./src/queries/event.queries'),
    resource: require('./src/queries/resource.queries'),
    booking: require('./src/queries/booking.queries'),
    catalog: require('./src/queries/catalog.queries'),
    university: require('./src/queries/university.queries'),
    request: require('./src/queries/request.queries'),
    notification: require('./src/queries/notification.queries'),
    pqrs: require('./src/queries/pqrs.queries'),
    storage: require('./src/queries/storage.queries'),
  },

  // Templates
  ...require('./src/templates/searchTemplates'),
  templates: require('./src/templates/searchTemplates'),

  // Utils
  utils: {
    ElasticsearchLogger: require('./src/utils/logger').ElasticsearchLogger,
    BulkProcessor: require('./src/utils/bulkHelper').BulkProcessor,
    IndexHelper: require('./src/utils/indexHelper').IndexHelper,
    ...require('./src/utils/monitoring'),
  },

  // ILM
  ilm: require('./src/ilm'),
};
```

PUERTA DE VERIFICACIÓN:

- ✅ `node -e "require('./index.js')"` resuelve sin errores
- ✅ El cliente ES tiene Circuit Breaker configurado
- ✅ Los mapeos son válidos para ES 8.x
- ✅ Las consultas están optimizadas
- ✅ El logger enterprise funciona correctamente
- ✅ BulkProcessor maneja errores y reintentos
- ✅ IndexHelper tiene métodos completos
- ✅ ILM está correctamente implementado

```

---

### 🔥 **Prompt 4 — Paquetes Compartidos: Token Bucket Enterprise + Shared-Types**

**Objetivo:** Implementar el algoritmo **Token Bucket Enterprise** con Redis backend para multi-réplica, y los esquemas de eventos y DTOs con validación estricta.

**Archivos a generar (8 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1 | `packages/shared-utils/src/tokenBucket.js` | Token Bucket con Redis backend |
| 2 | `packages/shared-utils/src/tokenBucket.redis.js` | Backend Redis para TB |
| 3 | `packages/shared-types/package.json` | Manifest |
| 4 | `packages/shared-types/index.js` | Export |
| 5 | `packages/shared-types/src/user.types.js` | DTOs con zod |
| 6 | `packages/shared-types/src/domain.types.js` | DTOs de dominio |
| 7 | `packages/shared-types/src/event.types.js` | Eventos + esquemas zod |
| 8 | `packages/shared-types/src/elasticsearch.types.js` | **NUEVO: Tipos ES** |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

PAQUETE 1 — TOKEN BUCKET ENTERPRISE:

src/tokenBucket.js (In-Memory + Redis Fallback):

```javascript
const { createRedisClient } = require('../database-client');

class TokenBucket {
  constructor({
    capacity,
    refillPerSecond,
    sweepIntervalMs = 60000,
    maxKeys = 10000,
    useRedis = false,
    redisConfig = null,
  }) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.buckets = new Map();
    this.lastRefill = Date.now();
    this.sweepInterval = setInterval(() => this.sweep(), sweepIntervalMs);
    this.maxKeys = maxKeys;
    this.useRedis = useRedis;

    if (useRedis && redisConfig) {
      this.redisClient = createRedisClient(redisConfig);
      this.redisPrefix = 'token_bucket:';
    }
  }

  async consume(key, cost = 1) {
    const now = Date.now();
    const bucket = await this.getBucket(key, now);

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      bucket.lastConsume = now;

      if (this.useRedis) {
        await this.saveBucketToRedis(key, bucket);
      }

      return {
        allowed: true,
        remaining: bucket.tokens,
        retryAfterSeconds: null,
      };
    }

    const tokensNeeded = cost - bucket.tokens;
    const retryAfterSeconds = Math.ceil(tokensNeeded / this.refillPerSecond);

    return {
      allowed: false,
      remaining: bucket.tokens,
      retryAfterSeconds,
    };
  }

  async getBucket(key, now) {
    let bucket;

    if (this.useRedis) {
      bucket = await this.getBucketFromRedis(key);
    }

    if (!bucket) {
      bucket = {
        tokens: this.capacity,
        lastRefill: now,
        lastConsume: now,
      };
    }

    // Refill tokens
    const timePassed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillPerSecond;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    return bucket;
  }

  async getBucketFromRedis(key) {
    try {
      const data = await this.redisClient.get(`${this.redisPrefix}${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading from Redis:', error.message);
      return null;
    }
  }

  async saveBucketToRedis(key, bucket) {
    try {
      const ttl = Math.ceil((this.capacity - bucket.tokens) / this.refillPerSecond) + 3600;
      await this.redisClient.setex(`${this.redisPrefix}${key}`, ttl, JSON.stringify(bucket));
    } catch (error) {
      console.error('Error saving to Redis:', error.message);
    }
  }

  async sweep() {
    const now = Date.now();
    const inactiveThreshold = now - this.sweepInterval;

    // Limpiar memory
    for (const [key, bucket] of this.buckets) {
      if (bucket.lastConsume < inactiveThreshold) {
        this.buckets.delete(key);
      }
    }

    // Limitar tamaño
    if (this.buckets.size > this.maxKeys) {
      const keysToDelete = Array.from(this.buckets.keys()).slice(
        0,
        this.buckets.size - this.maxKeys,
      );
      for (const key of keysToDelete) {
        this.buckets.delete(key);
      }
    }
  }

  async stop() {
    clearInterval(this.sweepInterval);
    if (this.redisClient) {
      await this.redisClient.close();
    }
  }

  getStats() {
    return {
      size: this.buckets.size,
      capacity: this.capacity,
      refillPerSecond: this.refillPerSecond,
      useRedis: this.useRedis,
    };
  }
}

const createTokenBucket = (config) => new TokenBucket(config);

module.exports = { TokenBucket, createTokenBucket };
```

src/tokenBucket.redis.js (Redis-Only):

```javascript
const { createRedisClient } = require('../database-client');

class RedisTokenBucket {
  constructor({ capacity, refillPerSecond, redisConfig, keyPrefix = 'token_bucket:' }) {
    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.redisClient = createRedisClient(redisConfig);
    this.keyPrefix = keyPrefix;
    this.script = `
      local tokensKey = KEYS[1]
      local now = tonumber(ARGV[1])
      local cost = tonumber(ARGV[2])
      local capacity = tonumber(ARGV[3])
      local refillPerSecond = tonumber(ARGV[4])
      
      local data = redis.call('GET', tokensKey)
      local tokens, lastRefill
      
      if data then
        local parts = cjson.decode(data)
        tokens = tonumber(parts.tokens)
        lastRefill = tonumber(parts.lastRefill)
      else
        tokens = capacity
        lastRefill = now
      end
      
      local timePassed = (now - lastRefill) / 1000
      local tokensToAdd = timePassed * refillPerSecond
      tokens = math.min(capacity, tokens + tokensToAdd)
      
      if tokens >= cost then
        tokens = tokens - cost
        local newData = cjson.encode({tokens = tokens, lastRefill = now, lastConsume = now})
        redis.call('SET', tokensKey, newData, 'EX', math.ceil((capacity - tokens) / refillPerSecond) + 3600)
        return {1, tokens, 0}
      else
        local tokensNeeded = cost - tokens
        local retryAfter = math.ceil(tokensNeeded / refillPerSecond)
        return {0, tokens, retryAfter}
      end
    `;
  }

  async consume(key, cost = 1) {
    const now = Date.now();

    try {
      const result = await this.redisClient.eval(
        this.script,
        1,
        `${this.keyPrefix}${key}`,
        now,
        cost,
        this.capacity,
        this.refillPerSecond,
      );

      return {
        allowed: result[0] === 1,
        remaining: result[1],
        retryAfterSeconds: result[2],
      };
    } catch (error) {
      console.error('Error in Redis Token Bucket:', error.message);
      // Fallback a in-memory
      return { allowed: false, remaining: 0, retryAfterSeconds: 5 };
    }
  }

  async getRemaining(key) {
    try {
      const data = await this.redisClient.get(`${this.keyPrefix}${key}`);
      return data ? JSON.parse(data).tokens : this.capacity;
    } catch (error) {
      return 0;
    }
  }

  async stop() {
    await this.redisClient.close();
  }
}

const createRedisTokenBucket = (config) => new RedisTokenBucket(config);

module.exports = { RedisTokenBucket, createRedisTokenBucket };
```

PAQUETE 2 — SHARED-TYPES (Enterprise):

src/elasticsearch.types.js (NUEVO):

```javascript
const { z } = require('zod');

// Tipos para Elasticsearch
const ElasticsearchIndexSchema = z.object({
  name: z.string(),
  body: z.record(z.any()),
});

const ElasticsearchSearchSchema = z.object({
  index: z.string().or(z.array(z.string())),
  body: z.record(z.any()),
});

const ElasticsearchBulkSchema = z.object({
  body: z.array(z.any()),
});

const ElasticsearchHitSchema = z.object({
  _index: z.string(),
  _id: z.string(),
  _score: z.number().optional(),
  _source: z.record(z.any()),
});

const ElasticsearchResponseSchema = z.object({
  took: z.number(),
  timed_out: z.boolean(),
  _shards: z.object({
    total: z.number(),
    successful: z.number(),
    skipped: z.number(),
    failed: z.number(),
  }),
  hits: z.object({
    total: z.object({
      value: z.number(),
      relation: z.string(),
    }),
    max_score: z.number().optional(),
    hits: z.array(ElasticsearchHitSchema),
  }),
});

// Tipos para mapeos
const ElasticsearchMappingSchema = z.object({
  settings: z.record(z.any()).optional(),
  mappings: z.record(z.any()),
});

// Tipos para consultas
const ElasticsearchQuerySchema = z.object({
  query: z.record(z.any()).optional(),
  from: z.number().optional(),
  size: z.number().optional(),
  sort: z.array(z.record(z.any())).optional(),
  aggs: z.record(z.any()).optional(),
  _source: z.array(z.string()).or(z.boolean()).optional(),
});

// Tipos para logging
const LogEntrySchema = z.object({
  '@timestamp': z.string().datetime(),
  service: z.string(),
  level: z.enum(['error', 'warn', 'info', 'debug', 'http']),
  message: z.string(),
  correlationId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  userId: z.string().optional(),
  http: z
    .object({
      method: z.string().optional(),
      path: z.string().optional(),
      statusCode: z.number().int().optional(),
      duration: z.number().int().optional(),
    })
    .optional(),
  error: z
    .object({
      name: z.string().optional(),
      message: z.string().optional(),
      stack: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

// Exportar todo
module.exports = {
  ElasticsearchIndexSchema,
  ElasticsearchSearchSchema,
  ElasticsearchBulkSchema,
  ElasticsearchHitSchema,
  ElasticsearchResponseSchema,
  ElasticsearchMappingSchema,
  ElasticsearchQuerySchema,
  LogEntrySchema,
};
```

PUERTA DE VERIFICACIÓN:

- ✅ Token Bucket funciona en memoria
- ✅ Token Bucket funciona con Redis
- ✅ Los esquemas zod validan correctamente
- ✅ Los tipos de ES son completos

```

---

## 🚀 **Resumen de Mejoras Enterprise**

### 🎯 **Patrones Implementados**

1. **Resiliencia:** Circuit Breaker, Retry con backoff exponencial, Fallback
2. **Seguridad:** TLS, Autenticación, RBAC, IP Filtering
3. **Escalabilidad:** Pool de conexiones, Bulk Processing, Sharding
4. **Observabilidad:** Métricas Prometheus, Health Checks, Logging estructurado
5. **Mantenibilidad:** Code Quality, Documentación, Testing
6. **Rendimiento:** Caché, Indexación optimizada, Consultas eficientes

### 📊 **Comparación de Niveles**

| Feature | Junior | Senior | **Enterprise** |
|---------|--------|--------|----------------|
| Error Handling | Try/Catch | AppError | **Circuit Breaker + Fallback** |
| Logging | console.log | Winston | **Structured Logging + Correlation IDs** |
| Database | Raw queries | Repository Pattern | **Connection Pool + Retry + Circuit Breaker** |
| Caching | None | Redis | **Redis + In-Memory + TTL** |
| API Design | Ad-hoc | RESTful | **OpenAPI + Versioning + Rate Limiting** |
| Security | None | Basic Auth | **TLS + JWT + RBAC + IP Filtering** |
| Testing | None | Unit Tests | **Unit + Integration + E2E + Coverage** |
| Monitoring | None | Health Check | **Prometheus + Metrics + Alerts** |
| Scalability | Single | Multiple | **Horizontal Scaling + Load Balancing** |
| Deployment | Manual | Scripts | **CI/CD + Kubernetes + Blue-Green** |

---

## 📦 **BLOQUE 2: El Borde del Sistema Enterprise (1 Prompt)**

---

### 🔥 **Prompt 5 — API Gateway Enterprise: Border Security + Elasticsearch Logging**

**Objetivo:** Implementar el **API Gateway Enterprise** con puertos fijos (3000-3011), prefijos `/api/v1/*`, middleware de proxy con balanceo de carga, trazabilidad con `X-Request-Id`, rate limiting perimetral con Redis Token Bucket, y **logging centralizado en Elasticsearch** con correlation IDs.

**Archivos a generar (22 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1 | `apps/api-gateway/src/config/env.js` | Validación estricta con Zod + múltiples entornos |
| 2 | `apps/api-gateway/src/config/logger.js` | **Winston + Elasticsearch Transport** |
| 3 | `apps/api-gateway/src/config/elasticsearch.js` | Cliente ES resiliente con Circuit Breaker |
| 4 | `apps/api-gateway/src/core/rateLimiter/tokenBucket.js` | Token Bucket con Redis backend |
| 5 | `apps/api-gateway/src/middleware/requestId.middleware.js` | Generación UUID v4 + header propagation |
| 6 | `apps/api-gateway/src/middleware/auth.middleware.js` | Validación JWT + RBAC + X-Service-Token |
| 7 | `apps/api-gateway/src/middleware/rateLimit.middleware.js` | Rate limiting por IP/Usuario/Endpoint |
| 8 | `apps/api-gateway/src/middleware/proxy.middleware.js` | Proxy inteligente con load balancing |
| 9 | `apps/api-gateway/src/middleware/error.handler.js` | Error handling con logging ES |
| 10 | `apps/api-gateway/src/middleware/tracing.middleware.js` | **Trazabilidad distribuida + ES** |
| 11 | `apps/api-gateway/src/middleware/health.middleware.js` | Health check + dependencias |
| 12 | `apps/api-gateway/src/routes/index.routes.js` | Ruteo dinámico a 11 servicios |
| 13 | `apps/api-gateway/src/routes/health.routes.js` | Endpoint `/health` con checks profundos |
| 14 | `apps/api-gateway/src/core/loaders/express.loader.js` | Carga express con middleware ordenado |
| 15 | `apps/api-gateway/src/app.js` | App Express + middleware registration |
| 16 | `apps/api-gateway/src/server.js` | Server HTTP/HTTPS con graceful shutdown |
| 17 | `apps/api-gateway/package.json` | Dependencias enterprise |
| 18 | `apps/api-gateway/Dockerfile` | Multi-stage build + healthcheck |
| 19 | `apps/api-gateway/.env.example` | Template de variables de entorno |
| 20 | `apps/api-gateway/README.md` | Documentación enterprise |
| 21 | `apps/api-gateway/tests/e2e/gateway.e2e.test.js` | Tests E2E completos |
| 22 | `apps/api-gateway/tests/unit/rateLimit.middleware.test.js` | Tests unitarios |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

CONFIGURACIÓN ENTERPRISE:

src/config/env.js (Validación estricta con Zod):

```javascript
const { z } = require('zod');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(64),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SERVICE_PORTS: z.record(z.coerce.number().int().positive()),
  CORS_ORIGINS: z.string().transform((s) => s.split(',')),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  ELASTICSEARCH_HOST: z.string().default('elasticsearch'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  ELASTICSEARCH_USER: z.string().default('elastic'),
  ELASTICSEARCH_PASSWORD: z.string().default('changeme'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const env = EnvSchema.parse(process.env);

// Validar puertos de servicios
const requiredServices = [
  'auth-service',
  'user-service',
  'catalog-service',
  'university-service',
  'resource-service',
  'booking-service',
  'request-service',
  'event-service',
  'notification-service',
  'pqrs-service',
  'storage-service',
];

for (const service of requiredServices) {
  if (!env.SERVICE_PORTS[service]) {
    throw new Error(`Missing PORT for service: ${service}`);
  }
}

module.exports = { env };
```

src/config/elasticsearch.js (Cliente ES resiliente):

```javascript
const { createResilientElasticsearchClient } = require('../../../packages/shared-elasticsearch');
const { env } = require('./env');

const esClient = createResilientElasticsearchClient({
  host: env.ELASTICSEARCH_HOST,
  port: env.ELASTICSEARCH_PORT,
  user: env.ELASTICSEARCH_USER,
  password: env.ELASTICSEARCH_PASSWORD,
  maxRetries: 3,
  requestTimeout: 10000
});

// Index para logs del gateway
const ensureGatewayIndex = async () => {
  await esClient.client.indices.create({
    index: 'uajs_gateway_logs',
    body: {
      settings: {
        number_of_shards: 2,
        number_of_replicas: 1,
        index.lifecycle.name: 'uajs_logs_policy'
      },
      mappings: {
        dynamic: 'strict',
        properties: {
          '@timestamp': { type: 'date' },
          service: { type: 'keyword' },
          level: { type: 'keyword' },
          message: { type: 'text' },
          correlationId: { type: 'keyword' },
          requestId: { type: 'keyword' },
          userId: { type: 'keyword' },
          http: {
            properties: {
              method: { type: 'keyword' },
              path: { type: 'keyword' },
              statusCode: { type: 'integer' },
              duration: { type: 'integer' },
              clientIp: { type: 'ip' }
            }
          },
          rateLimit: {
            properties: {
              remaining: { type: 'integer' },
              retryAfter: { type: 'integer' },
              exceeded: { type: 'boolean' }
            }
          }
        }
      }
    }
  }).catch(() => {}); // Ignorar si ya existe
};

module.exports = { esClient, ensureGatewayIndex };
```

src/config/logger.js (Winston + Elasticsearch):

```javascript
const winston = require('winston');
const { ElasticsearchTransport } = require('winston-elasticsearch');
const { env } = require('./env');
const { esClient } = require('./elasticsearch');

const elasticsearchTransport = new ElasticsearchTransport({
  client: esClient.client,
  index: 'uajs_gateway_logs',
  indexPattern: 'uajs_gateway_logs-YYYY.MM.DD',
  level: 'info',
  transformer: (logEntry) => ({
    ...logEntry,
    service: 'api-gateway',
    timestamp: new Date(logEntry.timestamp).toISOString(),
  }),
  flushInterval: 5000,
  bulkSize: 100,
});

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    elasticsearchTransport,
  ],
  exceptionHandlers: [new winston.transports.Console(), elasticsearchTransport],
  rejectionHandlers: [new winston.transports.Console(), elasticsearchTransport],
});

// Middleware para logging HTTP
const httpLogger = (req, res, next) => {
  const start = Date.now();
  const correlationId = req.headers['x-correlation-id'] || req.id;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      message: 'HTTP Request',
      correlationId,
      requestId: req.id,
      http: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        clientIp: req.ip,
      },
      userId: req.user?.id,
    });
  });

  next();
};

module.exports = { logger, httpLogger };
```

MIDDLEWARE ENTERPRISE:

src/middleware/requestId.middleware.js:

```javascript
const { v4: uuidv4 } = require('uuid');

const requestIdMiddleware = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const correlationId = req.headers['x-correlation-id'] || requestId;

  req.id = requestId;
  req.correlationId = correlationId;

  // Propagar headers
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);

  next();
};

module.exports = requestIdMiddleware;
```

src/middleware/auth.middleware.js (JWT + RBAC + X-Service-Token):

```javascript
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { UnauthorizedError, ForbiddenError } = require('../core/exceptions');
const { esClient } = require('../config/elasticsearch');

const SERVICE_TOKENS = new Map(); // Cache de service tokens

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const serviceToken = req.headers['x-service-token'];

    // Autenticación por JWT (usuario)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],
      });

      req.user = {
        id: payload.sub,
        roles: payload.roles || [],
        email: payload.email,
      };

      req.authType = 'user';

      // Log de autenticación en ES
      await esClient.client
        .index({
          index: 'uajs_gateway_auth_logs',
          body: {
            '@timestamp': new Date().toISOString(),
            service: 'api-gateway',
            level: 'info',
            message: 'User authenticated',
            correlationId: req.correlationId,
            requestId: req.id,
            userId: payload.sub,
            roles: payload.roles,
            path: req.path,
            method: req.method,
          },
        })
        .catch(() => {});
    }
    // Autenticación servicio-a-servicio
    else if (serviceToken) {
      const cached = SERVICE_TOKENS.get(serviceToken);
      if (cached) {
        req.service = cached;
        req.authType = 'service';
        return next();
      }

      // Validar contra auth-service (en producción)
      // Por ahora, validar contra lista estática
      const validTokens = process.env.SERVICE_TOKENS?.split(',') || [];
      if (!validTokens.includes(serviceToken)) {
        throw new UnauthorizedError('Invalid service token');
      }

      req.service = { name: 'internal-service' };
      req.authType = 'service';
      SERVICE_TOKENS.set(serviceToken, req.service);
    } else {
      // Rutas públicas
      const publicPaths = ['/health', '/api/v1/auth/login', '/api/v1/auth/register'];
      if (!publicPaths.some((p) => req.path.startsWith(p))) {
        throw new UnauthorizedError('Authentication required');
      }
    }

    next();
  } catch (error) {
    // Log de error de autenticación en ES
    await esClient.client
      .index({
        index: 'uajs_gateway_auth_logs',
        body: {
          '@timestamp': new Date().toISOString(),
          service: 'api-gateway',
          level: 'error',
          message: 'Authentication failed',
          correlationId: req.correlationId,
          requestId: req.id,
          error: {
            name: error.name,
            message: error.message,
            path: req.path,
            method: req.method,
          },
        },
      })
      .catch(() => {});

    next(error);
  }
};

const rbacMiddleware = (requiredRoles = []) => {
  return (req, res, next) => {
    if (req.authType !== 'user') {
      return next(new ForbiddenError('User authentication required'));
    }

    const hasRequiredRole = requiredRoles.some((role) => req.user.roles.includes(role));

    if (!hasRequiredRole) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
};

module.exports = { authMiddleware, rbacMiddleware };
```

src/middleware/rateLimit.middleware.js (Redis Token Bucket):

```javascript
const { createRedisTokenBucket } = require('../../../packages/shared-utils');
const { env } = require('../config/env');
const { esClient } = require('../config/elasticsearch');

const rateLimiter = createRedisTokenBucket({
  capacity: env.RATE_LIMIT_MAX_REQUESTS,
  refillPerSecond: env.RATE_LIMIT_MAX_REQUESTS / (env.RATE_LIMIT_WINDOW_MS / 1000),
  redisConfig: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
  keyPrefix: 'gateway_rate_limit:',
});

const rateLimitMiddleware = async (req, res, next) => {
  const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
  const endpointKey = `${key}:${req.path}`;

  const result = await rateLimiter.consume(endpointKey, 1);

  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.retryAfterSeconds));

  if (!result.allowed) {
    // Log de rate limit en ES
    await esClient.client
      .index({
        index: 'uajs_gateway_rate_limit_logs',
        body: {
          '@timestamp': new Date().toISOString(),
          service: 'api-gateway',
          level: 'warn',
          message: 'Rate limit exceeded',
          correlationId: req.correlationId,
          requestId: req.id,
          key,
          endpoint: req.path,
          method: req.method,
          retryAfter: result.retryAfterSeconds,
        },
      })
      .catch(() => {});

    return res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded',
      retryAfter: result.retryAfterSeconds,
      requestId: req.id,
    });
  }

  next();
};

module.exports = rateLimitMiddleware;
```

src/middleware/proxy.middleware.js (Load Balancing):

```javascript
const http = require('http');
const https = require('https');
const { env } = require('../config/env');
const { logger } = require('../config/logger');

const servicePorts = env.SERVICE_PORTS;

const proxyMiddleware = (serviceName) => {
  return async (req, res) => {
    const port = servicePorts[serviceName];
    if (!port) {
      logger.error(`Service ${serviceName} not configured`);
      return res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: `Service ${serviceName} is not configured`,
      });
    }

    const options = {
      hostname: serviceName,
      port,
      path: req.path,
      method: req.method,
      headers: {
        ...req.headers,
        'x-request-id': req.id,
        'x-correlation-id': req.correlationId,
        'x-user-id': req.user?.id,
        'x-user-roles': JSON.stringify(req.user?.roles || []),
        'x-forwarded-for': req.ip,
      },
    };

    const protocol = process.env.NODE_ENV === 'production' ? https : http;

    const proxyReq = protocol.request(options, (proxyRes) => {
      // Propagar headers
      Object.entries(proxyRes.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      res.writeHead(proxyRes.statusCode);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      logger.error('Proxy error:', {
        error: error.message,
        service: serviceName,
        path: req.path,
        correlationId: req.correlationId,
      });

      res.status(502).json({
        error: 'BAD_GATEWAY',
        message: `Service ${serviceName} unavailable`,
        requestId: req.id,
      });
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      res.status(504).json({
        error: 'GATEWAY_TIMEOUT',
        message: `Service ${serviceName} timeout`,
        requestId: req.id,
      });
    });

    proxyReq.setTimeout(30000);

    if (req.body) {
      proxyReq.write(JSON.stringify(req.body));
    }

    proxyReq.end();
  };
};

module.exports = proxyMiddleware;
```

RUTAS ENTERPRISE:

src/routes/index.routes.js:

```javascript
const express = require('express');
const proxyMiddleware = require('../middleware/proxy.middleware');
const authMiddleware = require('../middleware/auth.middleware');
const rateLimitMiddleware = require('../middleware/rateLimit.middleware');
const requestIdMiddleware = require('../middleware/requestId.middleware');

const router = express.Router();

// Middleware global
router.use(requestIdMiddleware);
router.use(rateLimitMiddleware);
router.use(authMiddleware);

// Ruteo a servicios
const serviceRoutes = {
  '/api/v1/auth': 'auth-service',
  '/api/v1/usuarios': 'user-service',
  '/api/v1/catalogos': 'catalog-service',
  '/api/v1/universidad': 'university-service',
  '/api/v1/recursos': 'resource-service',
  '/api/v1/reservas': 'booking-service',
  '/api/v1/solicitudes': 'request-service',
  '/api/v1/eventos': 'event-service',
  '/api/v1/pqrs': 'pqrs-service',
  '/api/v1/notificaciones': 'notification-service',
  '/api/v1/almacenamiento': 'storage-service',
};

Object.entries(serviceRoutes).forEach(([prefix, service]) => {
  router.use(prefix, proxyMiddleware(service));
});

module.exports = router;
```

src/app.js (Express + Middleware):

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const expressLoader = require('./core/loaders/express.loader');
const { env } = require('./config/env');
const { logger, httpLogger } = require('./config/logger');

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Loaders
app.use(expressLoader);

// HTTP logging
app.use(httpLogger);

// Routes
app.use('/', require('./routes/index.routes'));
app.use('/health', require('./routes/health.routes'));

// Error handling
app.use(require('./middleware/error.handler'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    requestId: req.id,
  });
});

module.exports = app;
```

src/server.js (HTTP/HTTPS):

```javascript
const app = require('./app');
const { env } = require('./config/env');
const { logger } = require('./config/logger');
const { ensureGatewayIndex } = require('./config/elasticsearch');

const server = require('http').createServer(app);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    // Cerrar conexiones ES
    try {
      const { esClient } = require('./config/elasticsearch');
      await esClient.client.close();
      logger.info('Elasticsearch client closed');
    } catch (error) {
      logger.error('Error closing ES client:', error.message);
    }

    process.exit(0);
  });

  // Forzar cierre después de 30s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Inicializar
const start = async () => {
  await ensureGatewayIndex();

  server.listen(env.PORT, () => {
    logger.info(`API Gateway running on port ${env.PORT}`, {
      env: env.NODE_ENV,
      service: 'api-gateway',
    });
  });
};

start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = server;
```

PUERTA DE VERIFICACIÓN:

- ✅ Gateway proxy a todos los servicios
- ✅ Autenticación JWT + Service Tokens
- ✅ Rate limiting con Redis Token Bucket
- ✅ Logging centralizado en Elasticsearch
- ✅ Trazabilidad con X-Request-Id y X-Correlation-Id
- ✅ Health check con dependencias
- ✅ Graceful shutdown
- ✅ Tests E2E pasan

```

---

## 📦 **BLOQUE 3: Núcleo de Identidad y Acceso Enterprise (2 Prompts)**

---

### 🔥 **Prompt 6 — Auth-Service Enterprise: Autenticación + Elasticsearch Events**

**Objetivo:** Implementar el servicio de autenticación **Enterprise** con login/registro, rotación de refresh tokens con TTL estrictos (15m access, 7d refresh), flujo asíncrono de recuperación de contraseña por correo usando BullMQ, y **indexación de eventos de autenticación en Elasticsearch** para análisis de seguridad.

**Archivos a generar (28 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1 | `apps/auth-service/src/config/env.js` | Validación Zod + JWT config |
| 2 | `apps/auth-service/src/config/database/mysql.js` | Pool MySQL con retry |
| 3 | `apps/auth-service/src/config/database/redis.js` | Cliente Redis con Circuit Breaker |
| 4 | `apps/auth-service/src/config/elasticsearch.js` | Cliente ES para eventos de auth |
| 5 | `apps/auth-service/src/config/queues.js` | Configuración BullMQ + Redis |
| 6 | `apps/auth-service/src/config/logger.js` | Logger + ES transport |
| 7 | `apps/auth-service/src/core/exceptions/*` | 6 errores personalizados |
| 8 | `apps/auth-service/src/core/loaders/express.loader.js` | Loader Express |
| 9 | `apps/auth-service/src/core/loaders/database.loader.js` | Loader DB |
| 10 | `apps/auth-service/src/core/helpers/pagination.helper.js` | Paginación |
| 11 | `apps/auth-service/src/modules/auth/auth.controller.js` | Controlador auth |
| 12 | `apps/auth-service/src/modules/auth/auth.service.js` | Servicio auth |
| 13 | `apps/auth-service/src/modules/auth/auth.repository.js` | Repositorio auth |
| 14 | `apps/auth-service/src/modules/auth/auth.validation.js` | Validación Zod |
| 15 | `apps/auth-service/src/modules/auth/auth.routes.js` | Rutas auth |
| 16 | `apps/auth-service/src/jobs/producers/email.producer.js` | Productor emails |
| 17 | `apps/auth-service/src/jobs/consumers/email.consumer.js` | Consumidor emails |
| 18 | `apps/auth-service/src/jobs/producers/auth.producer.js` | **NUEVO: Productor eventos ES** |
| 19 | `apps/auth-service/src/docs/swagger.yaml` | OpenAPI spec |
| 20 | `apps/auth-service/src/docs/swagger.config.js` | Config Swagger |
| 21 | `apps/auth-service/src/app.js` | App Express |
| 22 | `apps/auth-service/src/server.js` | Server |
| 23 | `apps/auth-service/package.json` | Dependencias |
| 24 | `apps/auth-service/Dockerfile` | Docker |
| 25 | `apps/auth-service/.env.example` | Variables |
| 26 | `apps/auth-service/README.md` | Documentación |
| 27 | `apps/auth-service/tests/unit/auth.service.test.js` | Tests unit |
| 28 | `apps/auth-service/tests/e2e/auth.e2e.test.js` | Tests E2E |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

CONFIGURACIÓN ENTERPRISE:

src/config/env.js:

```javascript
const { z } = require('zod');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  JWT_SECRET: z.string().min(64),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(64).optional(),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  MYSQL_HOST: z.string().default('mysql'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().default('uajs_user'),
  MYSQL_PASSWORD: z.string().default('changeme'),
  MYSQL_DATABASE: z.string().default('uajs_smart_campus'),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  ELASTICSEARCH_HOST: z.string().default('elasticsearch'),
  ELASTICSEARCH_PORT: z.coerce.number().int().positive().default(9200),
  EMAIL_QUEUE: z.string().default('auth_emails'),
  AUTH_EVENTS_INDEX: z.string().default('uajs_auth_events'),
});

module.exports = { env: EnvSchema.parse(process.env) };
```

src/config/elasticsearch.js:

```javascript
const { createResilientElasticsearchClient } = require('../../../packages/shared-elasticsearch');
const { env } = require('./env');

const esClient = createResilientElasticsearchClient({
  host: env.ELASTICSEARCH_HOST,
  port: env.ELASTICSEARCH_PORT,
  user: 'elastic',
  password: 'changeme',
  maxRetries: 3,
  requestTimeout: 10000
});

const ensureAuthEventsIndex = async () => {
  await esClient.client.indices.create({
    index: env.AUTH_EVENTS_INDEX,
    body: {
      settings: {
        number_of_shards: 2,
        number_of_replicas: 1,
        index.lifecycle.name: 'uajs_events_policy'
      },
      mappings: {
        dynamic: 'strict',
        properties: {
          '@timestamp': { type: 'date' },
          eventType: { type: 'keyword' },
          userId: { type: 'keyword' },
          email: { type: 'keyword' },
          ipAddress: { type: 'ip' },
          userAgent: { type: 'text' },
          status: { type: 'keyword' },
          metadata: { type: 'object', enabled: true },
          correlationId: { type: 'keyword' }
        }
      }
    }
  }).catch(() => {});
};

module.exports = { esClient, ensureAuthEventsIndex };
```

MÓDULO AUTH ENTERPRISE:

src/modules/auth/auth.service.js (Lógica de autenticación + ES events):

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { env } = require('../../config/env');
const { esClient } = require('../../config/elasticsearch');
const { UnauthorizedError, ConflictError, NotFoundError } = require('../../core/exceptions');
const { v4: uuidv4 } = require('uuid');

class AuthService {
  constructor(authRepository, emailProducer, authProducer) {
    this.authRepository = authRepository;
    this.emailProducer = emailProducer;
    this.authProducer = authProducer;
  }

  async register(registerDto) {
    const existingUser = await this.authRepository.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, env.BCRYPT_ROUNDS);
    const user = await this.authRepository.create({
      ...registerDto,
      password: hashedPassword,
      uuid: uuidv4(),
    });

    // Evento de registro en ES
    await this.logAuthEvent('user_registered', {
      userId: user.id,
      email: user.email,
      status: 'success',
    });

    return {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      message: 'Registration successful',
    };
  }

  async login(loginDto, req) {
    const user = await this.authRepository.findByEmail(loginDto.email);
    if (!user) {
      await this.logAuthEvent('login_failed', {
        email: loginDto.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'user_not_found',
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    const isValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isValid) {
      await this.logAuthEvent('login_failed', {
        userId: user.id,
        email: user.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status: 'invalid_password',
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles || ['user'],
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    const refreshToken = jwt.sign({ sub: user.id }, env.JWT_REFRESH_SECRET || env.JWT_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    await this.authRepository.updateRefreshToken(user.id, refreshToken);

    // Evento de login exitoso en ES
    await this.logAuthEvent('user_logged_in', {
      userId: user.id,
      email: user.email,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'success',
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        roles: user.roles || ['user'],
      },
    };
  }

  async refreshToken(refreshTokenDto) {
    const user = await this.authRepository.findByRefreshToken(refreshTokenDto.refreshToken);
    if (!user) {
      await this.logAuthEvent('refresh_failed', {
        status: 'invalid_token',
      });
      throw new UnauthorizedError('Invalid refresh token');
    }

    try {
      jwt.verify(refreshTokenDto.refreshToken, env.JWT_REFRESH_SECRET || env.JWT_SECRET);
    } catch (error) {
      await this.logAuthEvent('refresh_failed', {
        userId: user.id,
        status: 'expired_token',
      });
      throw new UnauthorizedError('Refresh token expired');
    }

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles || ['user'],
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    // Evento de refresh en ES
    await this.logAuthEvent('token_refreshed', {
      userId: user.id,
      status: 'success',
    });

    return {
      accessToken,
      expiresIn: env.JWT_EXPIRES_IN,
    };
  }

  async requestPasswordReset(email) {
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      // No revelar si el email existe
      return { message: 'If email exists, reset link sent' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await this.authRepository.createPasswordResetToken(user.id, resetTokenHash, expiresAt);

    // Encolar email
    await this.emailProducer.addJob('send_reset_email', {
      email: user.email,
      resetToken,
      userId: user.id,
    });

    // Evento de reset solicitado en ES
    await this.logAuthEvent('password_reset_requested', {
      userId: user.id,
      email: user.email,
      status: 'pending',
    });

    return { message: 'Password reset link sent' };
  }

  async confirmPasswordReset(confirmDto) {
    const tokenHash = crypto.createHash('sha256').update(confirmDto.token).digest('hex');
    const resetRequest = await this.authRepository.findPasswordResetToken(tokenHash);

    if (!resetRequest || resetRequest.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(confirmDto.password, env.BCRYPT_ROUNDS);
    await this.authRepository.updatePassword(resetRequest.userId, hashedPassword);
    await this.authRepository.invalidateRefreshTokens(resetRequest.userId);
    await this.authRepository.deletePasswordResetToken(tokenHash);

    // Evento de reset completado en ES
    await this.logAuthEvent('password_reset_completed', {
      userId: resetRequest.userId,
      status: 'success',
    });

    return { message: 'Password updated successfully' };
  }

  async logAuthEvent(eventType, metadata) {
    try {
      await esClient.client.index({
        index: env.AUTH_EVENTS_INDEX,
        body: {
          '@timestamp': new Date().toISOString(),
          eventType,
          service: 'auth-service',
          correlationId: metadata.correlationId || uuidv4(),
          ...metadata,
        },
      });
    } catch (error) {
      console.error('Error logging auth event to ES:', error.message);
    }
  }
}

module.exports = AuthService;
```

src/modules/auth/auth.repository.js:

```javascript
const { createMySQLPool } = require('../../../packages/database-client');
const { env } = require('../../config/env');

class AuthRepository {
  constructor() {
    this.pool = createMySQLPool({
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      connectionLimit: 10,
    });
  }

  async findByEmail(email) {
    const [rows] = await this.pool.query(
      "SELECT id, uuid, email, password, roles FROM usuarios WHERE email = ? AND estado = 'activo'",
      [email],
    );
    return rows[0];
  }

  async findById(id) {
    const [rows] = await this.pool.query(
      'SELECT id, uuid, email, roles FROM usuarios WHERE id = ?',
      [id],
    );
    return rows[0];
  }

  async create(userData) {
    const [result] = await this.pool.query(
      "INSERT INTO usuarios (uuid, email, password, nombres, apellidos, tipo_documento_id, numero_documento, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'activo')",
      [
        userData.uuid,
        userData.email,
        userData.password,
        userData.nombres,
        userData.apellidos,
        userData.tipoDocumentoId,
        userData.numeroDocumento,
      ],
    );
    return this.findById(result.insertId);
  }

  async updateRefreshToken(userId, refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.pool.query('UPDATE usuarios SET refresh_token = ? WHERE id = ?', [
      tokenHash,
      userId,
    ]);
  }

  async findByRefreshToken(refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const [rows] = await this.pool.query(
      'SELECT id, uuid, email, roles FROM usuarios WHERE refresh_token = ?',
      [tokenHash],
    );
    return rows[0];
  }

  async invalidateRefreshTokens(userId) {
    await this.pool.query('UPDATE usuarios SET refresh_token = NULL WHERE id = ?', [userId]);
  }

  async createPasswordResetToken(userId, tokenHash, expiresAt) {
    await this.pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt],
    );
  }

  async findPasswordResetToken(tokenHash) {
    const [rows] = await this.pool.query(
      'SELECT user_id FROM password_reset_tokens WHERE token = ? AND expires_at > NOW()',
      [tokenHash],
    );
    return rows[0];
  }

  async deletePasswordResetToken(tokenHash) {
    await this.pool.query('DELETE FROM password_reset_tokens WHERE token = ?', [tokenHash]);
  }

  async updatePassword(userId, password) {
    await this.pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [password, userId]);
  }
}

module.exports = AuthRepository;
```

JOBS ENTERPRISE:

src/jobs/producers/email.producer.js:

```javascript
const { createQueue } = require('../../../packages/database-client');
const { env } = require('../../config/env');

class EmailProducer {
  constructor() {
    this.queue = createQueue('auth_emails', {
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
      },
    });
  }

  async addJob(type, data) {
    await this.queue.add(type, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }
}

module.exports = EmailProducer;
```

src/jobs/consumers/email.consumer.js:

```javascript
const { env } = require('../../config/env');
const { esClient } = require('../../config/elasticsearch');

class EmailConsumer {
  constructor(queue) {
    this.queue = queue;
  }

  async process() {
    this.queue.process('send_reset_email', async (job) => {
      const { email, resetToken, userId } = job.data;

      // Simular envío de email
      console.log(`Sending reset email to ${email}`);

      // Log en ES
      await esClient.client
        .index({
          index: env.AUTH_EVENTS_INDEX,
          body: {
            '@timestamp': new Date().toISOString(),
            eventType: 'reset_email_sent',
            service: 'auth-service',
            userId,
            email,
            status: 'sent',
          },
        })
        .catch(() => {});

      return { success: true };
    });
  }
}

module.exports = EmailConsumer;
```

src/jobs/producers/auth.producer.js (Eventos ES):

```javascript
const { createQueue } = require('../../../packages/database-client');
const { env } = require('../../config/env');

class AuthProducer {
  constructor() {
    this.queue = createQueue('auth_events', {
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
      },
    });
  }

  async addAuthEvent(eventType, data) {
    await this.queue.add(
      'log_auth_event',
      {
        eventType,
        ...data,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );
  }
}

module.exports = AuthProducer;
```

PUERTA DE VERIFICACIÓN:

- ✅ Registro de usuarios con validación
- ✅ Login con JWT + refresh tokens
- ✅ Recuperación de contraseña asíncrona con BullMQ
- ✅ Eventos de autenticación indexados en Elasticsearch
- ✅ Rate limiting y seguridad
- ✅ Tests unitarios y E2E pasan
- ✅ Coverage > 80%

```

---

### 🔥 **Prompt 7 — User-Service Enterprise: Perfil Polimórfico + Elasticsearch Index**

**Objetivo:** Implementar el servicio de usuarios **Enterprise** con CRUD completo de usuarios/roles/permisos, el endpoint polimórfico `GET/PUT /usuarios/perfil` que hace JOIN dinámico según el rol (Estudiante, Docente, Administrativo), y **indexación automática de usuarios en Elasticsearch** para búsqueda avanzada.

**Archivos a generar (32 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1 | `apps/user-service/src/config/env.js` | Validación Zod |
| 2 | `apps/user-service/src/config/database/mysql.js` | Pool MySQL |
| 3 | `apps/user-service/src/config/database/redis.js` | Cliente Redis |
| 4 | `apps/user-service/src/config/elasticsearch.js` | Cliente ES + index template |
| 5 | `apps/user-service/src/config/queues.js` | BullMQ config |
| 6 | `apps/user-service/src/config/logger.js` | Logger + ES |
| 7 | `apps/user-service/src/core/exceptions/*` | 6 errores |
| 8 | `apps/user-service/src/core/loaders/express.loader.js` | Express loader |
| 9 | `apps/user-service/src/core/loaders/database.loader.js` | DB loader |
| 10 | `apps/user-service/src/core/helpers/pagination.helper.js` | Paginación |
| 11 | `apps/user-service/src/modules/usuario/usuario.controller.js` | CRUD usuarios |
| 12 | `apps/user-service/src/modules/usuario/usuario.service.js` | Servicio usuarios |
| 13 | `apps/user-service/src/modules/usuario/usuario.repository.js` | Repositorio |
| 14 | `apps/user-service/src/modules/usuario/usuario.validation.js` | Validación Zod |
| 15 | `apps/user-service/src/modules/usuario/usuario.routes.js` | Rutas |
| 16 | `apps/user-service/src/modules/rol/rol.controller.js` | CRUD roles |
| 17 | `apps/user-service/src/modules/rol/rol.service.js` | Servicio roles |
| 18 | `apps/user-service/src/modules/rol/rol.repository.js` | Repositorio |
| 19 | `apps/user-service/src/modules/rol/rol.validation.js` | Validación |
| 20 | `apps/user-service/src/modules/rol/rol.routes.js` | Rutas |
| 21 | `apps/user-service/src/modules/perfil/perfil.controller.js` | **Perfil polimórfico** |
| 22 | `apps/user-service/src/modules/perfil/perfil.service.js` | **Servicio perfil** |
| 23 | `apps/user-service/src/modules/perfil/perfil.routes.js` | Rutas perfil |
| 24 | `apps/user-service/src/jobs/producers/user.producer.js` | Productor ES |
| 25 | `apps/user-service/src/jobs/consumers/user.consumer.js` | Consumidor ES |
| 26 | `apps/user-service/src/docs/swagger.yaml` | OpenAPI |
| 27 | `apps/user-service/src/docs/swagger.config.js` | Config |
| 28 | `apps/user-service/src/app.js` | App |
| 29 | `apps/user-service/src/server.js` | Server |
| 30 | `apps/user-service/package.json` | Dependencias |
| 31 | `apps/user-service/Dockerfile` | Docker |
| 32 | `apps/user-service/.env.example` | Variables |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

CONFIGURACIÓN ENTERPRISE:

src/config/elasticsearch.js (Index Template para usuarios):

```javascript
const { createResilientElasticsearchClient } = require('../../../packages/shared-elasticsearch');
const { env } = require('./env');

const esClient = createResilientElasticsearchClient({
  host: env.ELASTICSEARCH_HOST,
  port: env.ELASTICSEARCH_PORT,
  user: 'elastic',
  password: 'changeme'
});

const ensureUserIndex = async () => {
  await esClient.client.indices.create({
    index: 'uajs_users',
    body: {
      settings: {
        number_of_shards: 3,
        number_of_replicas: 1,
        index.lifecycle.name: 'uajs_users_policy'
      },
      mappings: {
        dynamic: 'strict',
        properties: {
          id: { type: 'integer' },
          uuid: { type: 'keyword' },
          email: { type: 'keyword' },
          nombres: { type: 'text', analyzer: 'spanish' },
          apellidos: { type: 'text', analyzer: 'spanish' },
          numeroDocumento: { type: 'keyword' },
          tipoDocumento: {
            properties: {
              id: { type: 'integer' },
              nombre: { type: 'keyword' }
            }
          },
          roles: {
            type: 'nested',
            properties: {
              id: { type: 'integer' },
              nombre: { type: 'keyword' },
              permisos: {
                type: 'nested',
                properties: {
                  id: { type: 'integer' },
                  nombre: { type: 'keyword' },
                  modulo: { type: 'keyword' }
                }
              }
            }
          },
          perfil: {
            properties: {
              tipo: { type: 'keyword' },
              estudiante: {
                properties: {
                  id: { type: 'integer' },
                  codigo: { type: 'keyword' },
                  programa: {
                    properties: {
                      id: { type: 'integer' },
                      nombre: { type: 'text' }
                    }
                  }
                }
              },
              docente: {
                properties: {
                  id: { type: 'integer' },
                  codigo: { type: 'keyword' },
                  facultad: {
                    properties: {
                      id: { type: 'integer' },
                      nombre: { type: 'text' }
                    }
                  }
                }
              }
            }
          },
          estado: { type: 'keyword' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' }
        }
      }
    }
  }).catch(() => {});
};

module.exports = { esClient, ensureUserIndex };
```

MÓDULO USUARIO ENTERPRISE:

src/modules/usuario/usuario.service.js:

```javascript
const { esClient } = require('../../config/elasticsearch');

class UsuarioService {
  constructor(usuarioRepository) {
    this.usuarioRepository = usuarioRepository;
  }

  async create(createDto) {
    const user = await this.usuarioRepository.create(createDto);

    // Indexar en Elasticsearch
    await this.indexUser(user);

    return user;
  }

  async findAll(query) {
    return this.usuarioRepository.findAll(query);
  }

  async findById(id) {
    return this.usuarioRepository.findById(id);
  }

  async update(id, updateDto) {
    const user = await this.usuarioRepository.update(id, updateDto);

    // Re-indexar en Elasticsearch
    if (user) {
      await this.indexUser(user);
    }

    return user;
  }

  async delete(id) {
    const user = await this.usuarioRepository.findById(id);
    if (user) {
      // Eliminar de Elasticsearch
      await esClient.client
        .delete({
          index: 'uajs_users',
          id: user.uuid,
        })
        .catch(() => {});
    }

    return this.usuarioRepository.delete(id);
  }

  async indexUser(user) {
    try {
      await esClient.client.index({
        index: 'uajs_users',
        id: user.uuid,
        body: user,
      });
    } catch (error) {
      console.error('Error indexing user in ES:', error.message);
    }
  }

  async searchInElasticsearch(query) {
    const response = await esClient.client.search({
      index: 'uajs_users',
      body: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query.search,
                  fields: ['nombres', 'apellidos', 'email', 'numeroDocumento'],
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: [
              query.estado ? { term: { estado: query.estado } } : null,
              query.rol
                ? {
                    nested: {
                      path: 'roles',
                      query: { term: { 'roles.nombre': query.rol } },
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },
        from: query.offset || 0,
        size: query.limit || 20,
        sort: [{ [query.sortBy || 'createdAt']: { order: query.sortOrder || 'desc' } }],
      },
    });

    return {
      total: response.body.hits.total.value,
      users: response.body.hits.hits.map((hit) => hit._source),
    };
  }
}

module.exports = UsuarioService;
```

MÓDULO PERFIL POLIMÓRFICO:

src/modules/perfil/perfil.service.js:

```javascript
const { NotFoundError } = require('../../core/exceptions');

class PerfilService {
  constructor(usuarioRepository) {
    this.usuarioRepository = usuarioRepository;
  }

  async getPerfil(userId, currentUserId) {
    // Si es admin, puede ver cualquier perfil
    // Si no, solo puede ver su propio perfil
    const targetUserId = userId || currentUserId;

    const user = await this.usuarioRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // Obtener perfil polimórfico
    const perfil = await this.getPolimorphicProfile(user);

    return {
      ...user,
      perfil,
    };
  }

  async updatePerfil(userId, currentUserId, updateDto) {
    // Validar que solo se puede actualizar el propio perfil
    if (userId !== currentUserId) {
      throw new ForbiddenError('Solo puedes actualizar tu propio perfil');
    }

    const user = await this.usuarioRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // Actualizar según el tipo de perfil
    const updatedUser = await this.updatePolimorphicProfile(user, updateDto);

    return {
      ...updatedUser,
      perfil: await this.getPolimorphicProfile(updatedUser),
    };
  }

  async getPolimorphicProfile(user) {
    // Determinar el tipo de perfil según los roles
    const isEstudiante = user.roles.some((r) => r.nombre === 'estudiante');
    const isDocente = user.roles.some((r) => r.nombre === 'docente');
    const isAdministrativo = user.roles.some((r) => r.nombre === 'administrativo');

    const perfil = { tipo: 'basico' };

    if (isEstudiante) {
      const estudiante = await this.usuarioRepository.findEstudianteByUserId(user.id);
      perfil.tipo = 'estudiante';
      perfil.estudiante = estudiante;
    }

    if (isDocente) {
      const docente = await this.usuarioRepository.findDocenteByUserId(user.id);
      perfil.tipo = 'docente';
      perfil.docente = docente;
    }

    if (isAdministrativo) {
      const administrativo = await this.usuarioRepository.findAdministrativoByUserId(user.id);
      perfil.tipo = 'administrativo';
      perfil.administrativo = administrativo;
    }

    return perfil;
  }

  async updatePolimorphicProfile(user, updateDto) {
    const isEstudiante = user.roles.some((r) => r.nombre === 'estudiante');
    const isDocente = user.roles.some((r) => r.nombre === 'docente');

    if (isEstudiante && updateDto.estudiante) {
      await this.usuarioRepository.updateEstudiante(user.id, updateDto.estudiante);
    }

    if (isDocente && updateDto.docente) {
      await this.usuarioRepository.updateDocente(user.id, updateDto.docente);
    }

    // Actualizar datos básicos del usuario
    return this.usuarioRepository.update(user.id, {
      nombres: updateDto.nombres,
      apellidos: updateDto.apellidos,
      email: updateDto.email,
      numeroDocumento: updateDto.numeroDocumento,
    });
  }
}

module.exports = PerfilService;
```

src/modules/usuario/usuario.repository.js:

```javascript
const { createMySQLPool } = require('../../../packages/database-client');
const { env } = require('../../config/env');

class UsuarioRepository {
  constructor() {
    this.pool = createMySQLPool({
      host: env.MYSQL_HOST,
      port: env.MYSQL_PORT,
      user: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE,
      connectionLimit: 10,
    });
  }

  async findById(id) {
    const [rows] = await this.pool.query(
      `
      SELECT 
        u.id, u.uuid, u.email, u.nombres, u.apellidos, u.numero_documento as numeroDocumento, 
        u.estado, u.created_at as createdAt, u.updated_at as updatedAt,
        td.id as tipoDocumentoId, td.nombre as tipoDocumentoNombre,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', r.id,
            'nombre', r.nombre,
            'permisos', (
              SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', p.id,
                  'nombre', p.nombre,
                  'modulo', p.modulo
                )
              )
              FROM permisos p
              JOIN rol_permisos rp ON p.id = rp.permiso_id
              WHERE rp.rol_id = r.id
            )
          )
        ) as roles
      FROM usuarios u
      LEFT JOIN tipos_documento td ON u.tipo_documento_id = td.id
      LEFT JOIN usuario_roles ur ON u.id = ur.usuario_id
      LEFT JOIN roles r ON ur.rol_id = r.id
      WHERE u.id = ?
      GROUP BY u.id
    `,
      [id],
    );

    return rows[0];
  }

  async findByEmail(email) {
    const [rows] = await this.pool.query('SELECT id, uuid, email FROM usuarios WHERE email = ?', [
      email,
    ]);
    return rows[0];
  }

  async create(userData) {
    const [result] = await this.pool.query(
      "INSERT INTO usuarios (uuid, email, password, nombres, apellidos, tipo_documento_id, numero_documento, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'activo')",
      [
        userData.uuid,
        userData.email,
        userData.password,
        userData.nombres,
        userData.apellidos,
        userData.tipoDocumentoId,
        userData.numeroDocumento,
      ],
    );
    return this.findById(result.insertId);
  }

  async findAll(query) {
    const { limit = 20, offset = 0, estado, rol } = query;

    let sql = `
      SELECT 
        u.id, u.uuid, u.email, u.nombres, u.apellidos, u.numero_documento as numeroDocumento, 
        u.estado, u.created_at as createdAt, u.updated_at as updatedAt
      FROM usuarios u
      LEFT JOIN usuario_roles ur ON u.id = ur.usuario_id
      LEFT JOIN roles r ON ur.rol_id = r.id
    `;

    const conditions = [];
    const params = [];

    if (estado) {
      conditions.push('u.estado = ?');
      params.push(estado);
    }

    if (rol) {
      conditions.push('r.nombre = ?');
      params.push(rol);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY u.id LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await this.pool.query(sql, params);
    const [countRows] = await this.pool.query(
      'SELECT COUNT(DISTINCT u.id) as total FROM usuarios u LEFT JOIN usuario_roles ur ON u.id = ur.usuario_id LEFT JOIN roles r ON ur.rol_id = r.id' +
        (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''),
      params.slice(0, -2),
    );

    return {
      data: rows,
      total: countRows[0].total,
      limit,
      offset,
    };
  }

  async update(id, updateData) {
    await this.pool.query('UPDATE usuarios SET ? WHERE id = ?', [updateData, id]);
    return this.findById(id);
  }

  async delete(id) {
    await this.pool.query("UPDATE usuarios SET estado = 'inactivo' WHERE id = ?", [id]);
    return { success: true };
  }

  async findEstudianteByUserId(userId) {
    const [rows] = await this.pool.query(
      `
      SELECT 
        e.id, e.codigo, e.estado as estadoEstudiante,
        p.id as programaId, p.nombre as programaNombre,
        f.id as facultadId, f.nombre as facultadNombre
      FROM estudiantes e
      JOIN programas p ON e.programa_id = p.id
      JOIN facultades f ON p.facultad_id = f.id
      WHERE e.usuario_id = ?
    `,
      [userId],
    );
    return rows[0];
  }

  async findDocenteByUserId(userId) {
    const [rows] = await this.pool.query(
      `
      SELECT 
        d.id, d.codigo, d.estado as estadoDocente,
        f.id as facultadId, f.nombre as facultadNombre
      FROM docentes d
      JOIN facultades f ON d.facultad_id = f.id
      WHERE d.usuario_id = ?
    `,
      [userId],
    );
    return rows[0];
  }

  async updateEstudiante(userId, estudianteData) {
    await this.pool.query('UPDATE estudiantes SET ? WHERE usuario_id = ?', [
      estudianteData,
      userId,
    ]);
  }

  async updateDocente(userId, docenteData) {
    await this.pool.query('UPDATE docentes SET ? WHERE usuario_id = ?', [docenteData, userId]);
  }
}

module.exports = UsuarioRepository;
```

PUERTA DE VERIFICACIÓN:

- ✅ CRUD de usuarios funciona
- ✅ CRUD de roles y permisos funciona
- ✅ Perfil polimórfico devuelve datos correctos según rol
- ✅ Usuarios indexados en Elasticsearch
- ✅ Búsqueda en ES funciona
- ✅ Tests unitarios y E2E pasan
- ✅ Coverage > 80%

```

---

## 📦 **BLOQUE 4: Datos Maestros y Soporte Enterprise (3 Prompts)**

---

### 🔥 **Prompt 8 — Catalog-Service Enterprise: Catálogos + Caché Redis + Elasticsearch**

**Objetivo:** Implementar el servicio de catálogos **Enterprise** con CRUD completo de departamentos, ciudades, sedes y tipos de documento, **caché en Redis** para consultas frecuentes, y **indexación en Elasticsearch** para búsqueda geográfica y autocompletado.

**Archivos a generar (32 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1-6 | Configuración (env, DB, ES, Redis, queues, logger) | Configuración Enterprise |
| 7-12 | Excepciones y loaders | Core Enterprise |
| 13 | `apps/catalog-service/src/core/helpers/pagination.helper.js` | Paginación |
| 14-18 | Módulo departamento | CRUD + validación |
| 19-23 | Módulo ciudad | CRUD + validación |
| 24-28 | Módulo sede | CRUD + validación |
| 29-33 | Módulo tipo-documento | CRUD + validación |
| 34 | `apps/catalog-service/src/jobs/producers/catalog.producer.js` | Productor ES |
| 35 | `apps/catalog-service/src/jobs/consumers/catalog.consumer.js` | Consumidor ES |
| 36-37 | Docs (swagger.yaml, config) | OpenAPI |
| 38-39 | app.js, server.js | App Express |
| 40-43 | package.json, Dockerfile, .env.example, README.md | Configuración |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

CONFIGURACIÓN ENTERPRISE:

src/config/elasticsearch.js:

```javascript
const { createResilientElasticsearchClient } = require('../../../packages/shared-elasticsearch');
const { env } = require('./env');

const esClient = createResilientElasticsearchClient({
  host: env.ELASTICSEARCH_HOST,
  port: env.ELASTICSEARCH_PORT,
});

const ensureCatalogIndex = async () => {
  await esClient.client.indices
    .create({
      index: 'uajs_catalogs',
      body: {
        settings: {
          number_of_shards: 2,
          number_of_replicas: 1,
        },
        mappings: {
          dynamic: 'strict',
          properties: {
            type: { type: 'keyword' },
            id: { type: 'integer' },
            nombre: { type: 'text', analyzer: 'spanish' },
            codigo: { type: 'keyword' },
            estado: { type: 'keyword' },
            parent: {
              properties: {
                id: { type: 'integer' },
                type: { type: 'keyword' },
                nombre: { type: 'keyword' },
              },
            },
            location: {
              type: 'geo_point',
            },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    })
    .catch(() => {});
};

module.exports = { esClient, ensureCatalogIndex };
```

MÓDULO DEPARTAMENTO:

src/modules/departamento/departamento.service.js:

```javascript
const { esClient } = require('../../config/elasticsearch');

class DepartamentoService {
  constructor(departamentoRepository, redisClient) {
    this.departamentoRepository = departamentoRepository;
    this.redisClient = redisClient;
  }

  async create(createDto) {
    const dept = await this.departamentoRepository.create(createDto);

    // Indexar en ES
    await esClient.client
      .index({
        index: 'uajs_catalogs',
        id: `departamento_${dept.id}`,
        body: {
          type: 'departamento',
          ...dept,
        },
      })
      .catch(() => {});

    // Invalidar caché
    await this.redisClient.del('departamentos:all');

    return dept;
  }

  async findAll() {
    // Intentar cache
    const cached = await this.redisClient.get('departamentos:all');
    if (cached) {
      return JSON.parse(cached);
    }

    const depts = await this.departamentoRepository.findAll();

    // Cache por 1 hora
    await this.redisClient.setex('departamentos:all', 3600, JSON.stringify(depts));

    return depts;
  }

  async search(query) {
    const response = await esClient.client.search({
      index: 'uajs_catalogs',
      body: {
        query: {
          bool: {
            must: [
              { term: { type: 'departamento' } },
              {
                multi_match: {
                  query: query.search,
                  fields: ['nombre', 'codigo'],
                },
              },
            ],
          },
        },
        size: query.limit || 20,
      },
    });

    return response.body.hits.hits.map((hit) => hit._source);
  }
}

module.exports = DepartamentoService;
```

PUERTA DE VERIFICACIÓN:

- ✅ CRUD de todos los catálogos funciona
- ✅ Caché en Redis para consultas frecuentes
- ✅ Indexación en Elasticsearch
- ✅ Búsqueda geográfica y autocompletado
- ✅ Tests pasan
- ✅ Coverage > 80%

```

---

### 🔥 **Prompt 9 — University-Service Enterprise: Estructura Académica + ES Index**

**Objetivo:** Implementar el servicio universitario **Enterprise** con CRUD transaccional de empresas, terceros, facultades, programas, estudiantes y docentes, con **indexación automática en Elasticsearch** y validación de integridad referencial.

**Archivos a generar (40 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1-6 | Configuración | Config Enterprise |
| 7-12 | Excepciones y loaders | Core |
| 13 | pagination.helper.js | Paginación |
| 14-18 | Módulo empresa | CRUD |
| 19-23 | Módulo tercero | CRUD |
| 24-28 | Módulo estudiante | CRUD |
| 29-33 | Módulo docente | CRUD |
| 34-38 | Módulo facultad | CRUD |
| 39-43 | Módulo programa | CRUD |
| 44 | `apps/university-service/src/jobs/producers/university.producer.js` | Productor ES |
| 45 | `apps/university-service/src/jobs/consumers/university.consumer.js` | Consumidor |
| 46-47 | Docs | OpenAPI |
| 48-51 | app.js, server.js, package.json, Dockerfile | App |
| 52-53 | .env.example, README.md | Config |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

CONFIGURACIÓN ENTERPRISE:

src/config/elasticsearch.js:

```javascript
const { createResilientElasticsearchClient } = require('../../../packages/shared-elasticsearch');

const esClient = createResilientElasticsearchClient({
  host: process.env.ELASTICSEARCH_HOST,
  port: process.env.ELASTICSEARCH_PORT,
});

const ensureUniversityIndex = async () => {
  await esClient.client.indices
    .create({
      index: 'uajs_university',
      body: {
        settings: {
          number_of_shards: 3,
          number_of_replicas: 1,
        },
        mappings: {
          dynamic: 'strict',
          properties: {
            type: { type: 'keyword' },
            id: { type: 'integer' },
            nombre: { type: 'text', analyzer: 'spanish' },
            codigo: { type: 'keyword' },
            estado: { type: 'keyword' },
            relaciones: {
              type: 'nested',
              properties: {
                type: { type: 'keyword' },
                id: { type: 'integer' },
                nombre: { type: 'keyword' },
              },
            },
          },
        },
      },
    })
    .catch(() => {});
};

module.exports = { esClient, ensureUniversityIndex };
```

MÓDULO TERCERO:

src/modules/tercero/tercero.service.js:

```javascript
const { esClient } = require('../../config/elasticsearch');

class TerceroService {
  constructor(terceroRepository) {
    this.terceroRepository = terceroRepository;
  }

  async create(createDto) {
    const tercero = await this.terceroRepository.create(createDto);

    // Indexar en ES con relaciones
    await this.indexTercero(tercero);

    return tercero;
  }

  async indexTercero(tercero) {
    const indexData = {
      type: 'tercero',
      ...tercero,
      relaciones: [],
    };

    if (tercero.Empresa) {
      indexData.relaciones.push({
        type: 'empresa',
        id: tercero.empresaId,
        nombre: tercero.Empresa.nombre,
      });
    }

    await esClient.client
      .index({
        index: 'uajs_university',
        id: `tercero_${tercero.id}`,
        body: indexData,
      })
      .catch(() => {});
  }

  async search(query) {
    const response = await esClient.client.search({
      index: 'uajs_university',
      body: {
        query: {
          bool: {
            must: [
              { term: { type: query.type || 'tercero' } },
              {
                multi_match: {
                  query: query.search,
                  fields: ['nombre', 'codigo', 'numeroDocumento'],
                },
              },
            ],
          },
        },
        size: query.limit || 20,
      },
    });

    return response.body.hits.hits.map((hit) => hit._source);
  }
}

module.exports = TerceroService;
```

PUERTA DE VERIFICACIÓN:

- ✅ CRUD transaccional de todas las entidades
- ✅ Indexación en Elasticsearch con relaciones
- ✅ Búsqueda avanzada funciona
- ✅ Tests pasan
- ✅ Coverage > 80%

```

---

### 🔥 **Prompt 10 — Storage-Service Enterprise: Almacenamiento Seguro + ES Metadata**

**Objetivo:** Implementar el servicio de almacenamiento **Enterprise** con subida segura usando Multer, validación estricta de extensiones (solo PDFs e imágenes), renombrado de archivos por UUID, y **indexación de metadata en Elasticsearch** para búsqueda de archivos.

**Archivos a generar (18 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1-6 | Configuración | Config Enterprise |
| 7-12 | Excepciones y loaders | Core |
| 13 | pagination.helper.js | Paginación |
| 14-18 | Módulo archivo | CRUD + Multer |
| 19 | `apps/storage-service/src/jobs/producers/storage.producer.js` | Productor ES |
| 20 | `apps/storage-service/src/jobs/consumers/storage.consumer.js` | Consumidor |
| 21-22 | Docs | OpenAPI |
| 23-26 | app.js, server.js, package.json, Dockerfile, .env.example, README.md | App |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

CONFIGURACIÓN ENTERPRISE:

src/modules/archivo/archivo.service.js:

```javascript
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { esClient } = require('../../config/elasticsearch');
const { ConflictError, ValidationError } = require('../../core/exceptions');

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new ValidationError(
        `Invalid file type. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
      ),
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

class ArchivoService {
  constructor(archivoRepository) {
    this.archivoRepository = archivoRepository;
  }

  async uploadFile(file, metadata) {
    const ext = path.extname(file.originalname).toLowerCase();
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join('/uploads', fileName);

    // Guardar archivo (en producción, usar S3 o similar)
    // Por ahora, solo metadata
    const archivo = await this.archivoRepository.create({
      uuid: uuidv4(),
      nombreOriginal: file.originalname,
      nombreAlmacenado: fileName,
      ruta: filePath,
      tipo: file.mimetype,
      tamano: file.size,
      extension: ext,
      metadata: JSON.stringify(metadata || {}),
      usuarioId: metadata?.usuarioId,
    });

    // Indexar metadata en ES
    await esClient.client
      .index({
        index: 'uajs_storage',
        id: archivo.uuid,
        body: {
          ...archivo,
          searchableText: file.originalname,
        },
      })
      .catch(() => {});

    return archivo;
  }

  async searchFiles(query) {
    const response = await esClient.client.search({
      index: 'uajs_storage',
      body: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query.search,
                  fields: ['nombreOriginal', 'metadata'],
                },
              },
            ],
            filter: [
              query.usuarioId ? { term: { usuarioId: query.usuarioId } } : null,
              query.tipo ? { term: { tipo: query.tipo } } : null,
            ].filter(Boolean),
          },
        },
        from: query.offset || 0,
        size: query.limit || 20,
      },
    });

    return {
      total: response.body.hits.total.value,
      files: response.body.hits.hits.map((hit) => hit._source),
    };
  }
}

module.exports = { ArchivoService, upload };
```

PUERTA DE VERIFICACIÓN:

- ✅ Subida de archivos con validación estricta
- ✅ Metadata indexada en Elasticsearch
- ✅ Búsqueda de archivos funciona
- ✅ Tests pasan
- ✅ Coverage > 80%

```

---

## 📦 **BLOQUE 5: Lógica de Negocio y Transacciones Enterprise (4 Prompts)**

---

### 🔥 **Prompt 11 — Resource-Service & Booking-Service Enterprise: Reservas + ES Events**

**Objetivo:** Implementar los servicios de recursos y reservas **Enterprise** con gestión de inventarios, validador de solapamiento de horarios en reservas, emisión de `ReservaConfirmadaEvent` a BullMQ, y **logging de eventos en Elasticsearch** para análisis de uso.

**Archivos a generar (64 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1-32 | Resource-Service (config, core, modules, jobs, docs, app) | Servicio completo |
| 33-64 | Booking-Service (config, core, modules, jobs, docs, app) | Servicio completo |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

RESOURCE-SERVICE:

src/modules/recurso/recurso.service.js:

```javascript
const { esClient } = require('../../config/elasticsearch');

class RecursoService {
  constructor(recursoRepository) {
    this.recursoRepository = recursoRepository;
  }

  async create(createDto) {
    const recurso = await this.recursoRepository.create(createDto);

    // Indexar en ES
    await esClient.client
      .index({
        index: 'uajs_resources',
        id: recurso.uuid,
        body: {
          type: 'recurso',
          ...recurso,
          disponible: recurso.estado === 'activo',
        },
      })
      .catch(() => {});

    return recurso;
  }

  async findAvailable(query) {
    const response = await esClient.client.search({
      index: 'uajs_resources',
      body: {
        query: {
          bool: {
            must: [
              { term: { disponible: true } },
              query.tipoId ? { term: { tipoRecursoId: query.tipoId } } : null,
              query.sedeId ? { term: { sedeId: query.sedeId } } : null,
            ].filter(Boolean),
          },
        },
        size: query.limit || 20,
      },
    });

    return response.body.hits.hits.map((hit) => hit._source);
  }
}

module.exports = RecursoService;
```

BOOKING-SERVICE:

src/modules/reserva/reserva.service.js:

```javascript
const { ConflictError } = require('../../core/exceptions');
const { esClient } = require('../../config/elasticsearch');

class ReservaService {
  constructor(reservaRepository, bookingProducer) {
    this.reservaRepository = reservaRepository;
    this.bookingProducer = bookingProducer;
  }

  async create(createDto, userId) {
    // Validar solapamiento
    const existing = await this.reservaRepository.findOverlapping(
      createDto.recursoId,
      createDto.fechaInicio,
      createDto.fechaFin,
    );

    if (existing.length > 0) {
      throw new ConflictError('SLOT_CONFLICT', 'El recurso ya está reservado en ese horario');
    }

    const reserva = await this.reservaRepository.create({
      ...createDto,
      usuarioId: userId,
      estado: 'confirmada',
    });

    // Emitir evento
    await this.bookingProducer.addJob('reserva_confirmada', {
      reservaId: reserva.id,
      usuarioId: userId,
      recursoId: createDto.recursoId,
    });

    // Log en ES
    await esClient.client
      .index({
        index: 'uajs_bookings',
        id: reserva.uuid,
        body: {
          type: 'reserva',
          ...reserva,
          usuarioId: userId,
        },
      })
      .catch(() => {});

    return reserva;
  }

  async validateOverlap(recursoId, fechaInicio, fechaFin) {
    const existing = await this.reservaRepository.findOverlapping(recursoId, fechaInicio, fechaFin);
    return existing.length === 0;
  }
}

module.exports = ReservaService;
```

src/jobs/producers/reserva.producer.js:

```javascript
const { createQueue } = require('../../../packages/database-client');

class ReservaProducer {
  constructor() {
    this.queue = createQueue('booking_events', {
      redis: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
    });
  }

  async addJob(type, data) {
    await this.queue.add(type, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}

module.exports = ReservaProducer;
```

PUERTA DE VERIFICACIÓN:

- ✅ CRUD de recursos funciona
- ✅ Validación de solapamiento funciona
- ✅ Eventos emitidos a BullMQ
- ✅ Logging en Elasticsearch
- ✅ Tests pasan
- ✅ Coverage > 80%

```

---

### 🔥 **Prompt 12 — Request-Service Enterprise: Solicitudes + Historial Transaccional**

**Objetivo:** Implementar el servicio de solicitudes **Enterprise** con registro de solicitudes, historial obligatorio (`solicitud_historial`) ejecutado dentro de la misma transacción SQL, y **indexación en Elasticsearch** para seguimiento.

**Archivos a generar (32 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1-32 | Request-Service completo | Todos los archivos |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

src/modules/solicitud/solicitud.service.js:

```javascript
const { esClient } = require('../../config/elasticsearch');

class SolicitudService {
  constructor(solicitudRepository, requestProducer) {
    this.solicitudRepository = solicitudRepository;
    this.requestProducer = requestProducer;
  }

  async create(createDto, userId) {
    return this.solicitudRepository.transaction(async (connection) => {
      // Crear solicitud
      const solicitud = await this.solicitudRepository.createWithConnection(
        {
          ...createDto,
          usuarioId: userId,
          estado: 'pendiente',
        },
        connection,
      );

      // Crear historial
      await this.solicitudRepository.createHistorialWithConnection(
        {
          solicitudId: solicitud.id,
          estadoAnterior: null,
          estadoNuevo: 'pendiente',
          observacion: 'Solicitud creada',
          usuarioId: userId,
        },
        connection,
      );

      // Emitir evento
      await this.requestProducer.addJob('solicitud_creada', {
        solicitudId: solicitud.id,
        usuarioId: userId,
      });

      // Log en ES
      await esClient.client
        .index({
          index: 'uajs_requests',
          id: solicitud.uuid,
          body: {
            type: 'solicitud',
            ...solicitud,
            usuarioId: userId,
          },
        })
        .catch(() => {});

      return solicitud;
    });
  }

  async changeEstado(solicitudId, cambioDto, userId) {
    return this.solicitudRepository.transaction(async (connection) => {
      const solicitud = await this.solicitudRepository.findByIdWithConnection(
        solicitudId,
        connection,
      );
      if (!solicitud) {
        throw new NotFoundError('Solicitud no encontrada');
      }

      // Crear historial
      await this.solicitudRepository.createHistorialWithConnection(
        {
          solicitudId: solicitud.id,
          estadoAnterior: solicitud.estado,
          estadoNuevo: cambioDto.estado,
          observacion: cambioDto.observacion,
          usuarioId: userId,
        },
        connection,
      );

      // Actualizar solicitud
      const updated = await this.solicitudRepository.updateWithConnection(
        solicitudId,
        { estado: cambioDto.estado },
        connection,
      );

      // Emitir evento
      await this.requestProducer.addJob('solicitud_estado_cambiado', {
        solicitudId: solicitud.id,
        estadoAnterior: solicitud.estado,
        estadoNuevo: cambioDto.estado,
        usuarioId: userId,
      });

      return updated;
    });
  }
}

module.exports = SolicitudService;
```

PUERTA DE VERIFICACIÓN:

- ✅ CRUD de solicitudes funciona
- ✅ Historial se crea en la misma transacción
- ✅ Eventos emitidos
- ✅ Indexación en ES
- ✅ Tests pasan
- ✅ Coverage > 80%

```

---

### 🔥 **Prompt 13 — Event-Service & PQRS-Service Enterprise: Eventos + PQRS**

**Objetivo:** Implementar los servicios de eventos y PQRS **Enterprise** con gestión completa, emisión de eventos a BullMQ, y **indexación en Elasticsearch** para análisis de tendencias.

**Archivos a generar (64 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1-32 | Event-Service completo | Todos los archivos |
| 33-64 | PQRS-Service completo | Todos los archivos |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

EVENT-SERVICE:

src/modules/evento/evento.service.js:

```javascript
const { esClient } = require('../../config/elasticsearch');

class EventoService {
  constructor(eventoRepository, eventProducer) {
    this.eventoRepository = eventoRepository;
    this.eventProducer = eventProducer;
  }

  async create(createDto, userId) {
    const evento = await this.eventoRepository.create({
      ...createDto,
      usuarioId: userId,
      estado: 'programado',
    });

    // Emitir evento
    await this.eventProducer.addJob('evento_programado', {
      eventoId: evento.id,
      usuarioId: userId,
    });

    // Indexar en ES
    await esClient.client
      .index({
        index: 'uajs_events',
        id: evento.uuid,
        body: {
          type: 'evento',
          ...evento,
          usuarioId: userId,
        },
      })
      .catch(() => {});

    return evento;
  }

  async getUpcoming() {
    const response = await esClient.client.search({
      index: 'uajs_events',
      body: {
        query: {
          bool: {
            must: [{ term: { estado: 'programado' } }, { range: { fechaInicio: { gte: 'now' } } }],
          },
        },
        sort: [{ fechaInicio: { order: 'asc' } }],
        size: 20,
      },
    });

    return response.body.hits.hits.map((hit) => hit._source);
  }
}

module.exports = EventoService;
```

PQRS-SERVICE:

src/modules/pqrs/pqrs.service.js:

```javascript
const { esClient } = require('../../config/elasticsearch');

class PqrsService {
  constructor(pqrsRepository, pqrsProducer) {
    this.pqrsRepository = pqrsRepository;
    this.pqrsProducer = pqrsProducer;
  }

  async create(createDto, userId) {
    const pqrs = await this.pqrsRepository.create({
      ...createDto,
      usuarioId: userId,
      estado: 'pendiente',
    });

    // Emitir evento
    await this.pqrsProducer.addJob('pqrs_creada', {
      pqrsId: pqrs.id,
      usuarioId: userId,
    });

    // Indexar en ES
    await esClient.client
      .index({
        index: 'uajs_pqrs',
        id: pqrs.uuid,
        body: {
          type: 'pqrs',
          ...pqrs,
          usuarioId: userId,
        },
      })
      .catch(() => {});

    return pqrs;
  }

  async respond(pqrsId, respuestaDto, userId) {
    const pqrs = await this.pqrsRepository.findById(pqrsId);
    if (!pqrs) {
      throw new NotFoundError('PQRS no encontrada');
    }

    const respuesta = await this.pqrsRepository.createRespuesta({
      pqrsId,
      respuesta: respuestaDto.respuesta,
      usuarioId: userId,
    });

    // Actualizar estado
    await this.pqrsRepository.update(pqrsId, { estado: 'respondida' });

    // Emitir evento
    await this.pqrsProducer.addJob('pqrs_respondida', {
      pqrsId,
      respuestaId: respuesta.id,
      usuarioId: userId,
    });

    return respuesta;
  }
}

module.exports = PqrsService;
```

PUERTA DE VERIFICACIÓN:

- ✅ CRUD de eventos y PQRS funciona
- ✅ Eventos emitidos a BullMQ
- ✅ Indexación en Elasticsearch
- ✅ Tests pasan
- ✅ Coverage > 80%

```

---

### 🔥 **Prompt 14 — Notification-Service Enterprise: Consumidor de Eventos + ES**

**Objetivo:** Implementar el servicio de notificaciones **Enterprise** como consumidor de BullMQ que escucha todos los eventos (ReservaConfirmada, SolicitudCreada, EventoProgramado, PqrsRespondida) y genera alertas en la tabla `notificaciones`, con **indexación en Elasticsearch** para análisis de notificaciones.

**Archivos a generar (32 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1-32 | Notification-Service completo | Todos los archivos |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

src/jobs/consumers/notificacion.consumer.js:

```javascript
const { esClient } = require('../../config/elasticsearch');

class NotificacionConsumer {
  constructor(queue, notificacionRepository) {
    this.queue = queue;
    this.notificacionRepository = notificacionRepository;
  }

  async process() {
    // Reserva confirmada
    this.queue.process('reserva_confirmada', async (job) => {
      const { reservaId, usuarioId, recursoId } = job.data;

      const notificacion = await this.notificacionRepository.create({
        usuarioId,
        titulo: 'Reserva Confirmada',
        mensaje: `Tu reserva #${reservaId} ha sido confirmada`,
        tipo: 'reserva',
        referenciaId: reservaId,
        estado: 'pendiente',
      });

      // Indexar en ES
      await this.indexNotification(notificacion);

      return { success: true };
    });

    // Solicitud creada
    this.queue.process('solicitud_creada', async (job) => {
      const { solicitudId, usuarioId } = job.data;

      await this.notificacionRepository.create({
        usuarioId,
        titulo: 'Nueva Solicitud',
        mensaje: `Tu solicitud #${solicitudId} ha sido registrada`,
        tipo: 'solicitud',
        referenciaId: solicitudId,
        estado: 'pendiente',
      });

      return { success: true };
    });

    // Evento programado
    this.queue.process('evento_programado', async (job) => {
      const { eventoId, usuarioId } = job.data;

      await this.notificacionRepository.create({
        usuarioId,
        titulo: 'Nuevo Evento',
        mensaje: `Nuevo evento programado: #${eventoId}`,
        tipo: 'evento',
        referenciaId: eventoId,
        estado: 'pendiente',
      });

      return { success: true };
    });

    // PQRS respondida
    this.queue.process('pqrs_respondida', async (job) => {
      const { pqrsId, respuestaId, usuarioId } = job.data;

      await this.notificacionRepository.create({
        usuarioId,
        titulo: 'PQRS Respondida',
        mensaje: `Tu PQRS #${pqrsId} ha sido respondida`,
        tipo: 'pqrs',
        referenciaId: pqrsId,
        estado: 'pendiente',
      });

      return { success: true };
    });
  }

  async indexNotification(notificacion) {
    try {
      await esClient.client.index({
        index: 'uajs_notifications',
        id: notificacion.uuid,
        body: {
          type: 'notificacion',
          ...notificacion,
        },
      });
    } catch (error) {
      console.error('Error indexing notification:', error.message);
    }
  }
}

module.exports = NotificacionConsumer;
```

PUERTA DE VERIFICACIÓN:

- ✅ Consumidor de BullMQ funciona
- ✅ Notificaciones creadas para todos los eventos
- ✅ Indexación en Elasticsearch
- ✅ Tests pasan
- ✅ Coverage > 80%

```

---

## 📦 **BLOQUE 6: Despliegue, Pruebas y Cierre Enterprise (2 Prompts)**

---

### 🔥 **Prompt 15 — Tooling Operativo Enterprise: Migraciones + Scripts + Seeds**

**Objetivo:** Implementar el **tooling operativo Enterprise** con script de migraciones (`migrate.js`) con transacciones, scripts de pruebas globales, seeds de prueba para todos los servicios, y **scripts de Elasticsearch** para indexación masiva y reindexación.

**Archivos a generar (20 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1 | `scripts/migrations/migrate.js` | Runner de migraciones |
| 2 | `scripts/migrations/ms-*_001_init.sql` | Schemas iniciales por servicio |
| 3 | `scripts/seed/seed-universidad.js` | Seed universidad |
| 4 | `scripts/seed/seed-servicios.js` | Seed servicios |
| 5 | `scripts/elasticsearch/index-all.js` | Indexación masiva |
| 6 | `scripts/elasticsearch/setup-mappings.js` | Configurar mapeos |
| 7 | `scripts/elasticsearch/reindex.js` | Reindexación |
| 8-20 | Tests globales | Scripts de prueba |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

scripts/migrations/migrate.js:

```javascript
const fs = require('fs');
const path = require('path');
const { createMySQLPool } = require('../packages/database-client');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

class MigrationRunner {
  constructor() {
    this.pool = createMySQLPool({
      host: process.env.MYSQL_HOST || 'mysql',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'uajs_user',
      password: process.env.MYSQL_PASSWORD || 'changeme',
      database: process.env.MYSQL_DATABASE || 'uajs_smart_campus',
    });
  }

  async run() {
    // Crear tabla de migraciones si no existe
    await this.ensureMigrationsTable();

    // Obtener migraciones ejecutadas
    const executed = await this.getExecutedMigrations();

    // Obtener migraciones pendientes
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!executed.includes(file)) {
        await this.executeMigration(file);
      }
    }
  }

  async ensureMigrationsTable() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async getExecutedMigrations() {
    const [rows] = await this.pool.query('SELECT filename FROM migrations');
    return rows.map((r) => r.filename);
  }

  async executeMigration(filename) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      await this.pool.query(sql);
      await this.pool.query('INSERT INTO migrations (filename) VALUES (?)', [filename]);
      console.log(`✅ Migration executed: ${filename}`);
    } catch (error) {
      console.error(`❌ Migration failed: ${filename}`, error.message);
      throw error;
    }
  }
}

const runner = new MigrationRunner();
runner
  .run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

module.exports = MigrationRunner;
```

scripts/seed/seed-universidad.js:

```javascript
const { createMySQLPool } = require('../packages/database-client');
const { esClient } = require('../apps/catalog-service/src/config/elasticsearch');

const pool = createMySQLPool({
  host: process.env.MYSQL_HOST || 'mysql',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'uajs_user',
  password: process.env.MYSQL_PASSWORD || 'changeme',
  database: process.env.MYSQL_DATABASE || 'uajs_smart_campus',
});

const seedData = {
  tiposDocumento: [
    { nombre: 'Cédula de Ciudadanía', codigo: 'CC' },
    { nombre: 'Tarjeta de Identidad', codigo: 'TI' },
    { nombre: 'Pasaporte', codigo: 'PA' },
  ],
  departamentos: [
    { nombre: 'Antioquia', codigo: '05' },
    { nombre: 'Bogotá D.C.', codigo: '11' },
  ],
  ciudades: [
    { nombre: 'Medellín', codigo: '001', departamentoId: 1 },
    { nombre: 'Bogotá', codigo: '001', departamentoId: 2 },
  ],
  sedes: [{ nombre: 'Sede Principal', direccion: 'Calle 10 #5-20', ciudadId: 1 }],
};

const seed = async () => {
  for (const [table, data] of Object.entries(seedData)) {
    for (const item of data) {
      const columns = Object.keys(item).join(', ');
      const values = Object.values(item)
        .map((v) => (typeof v === 'string' ? `'${v}'` : v))
        .join(', ');

      await pool.query(`INSERT IGNORE INTO ${table} (${columns}) VALUES (${values})`);

      // Indexar en ES
      await esClient.client
        .index({
          index: 'uajs_catalogs',
          id: `${table}_${item.codigo || item.id}`,
          body: { type: table, ...item },
        })
        .catch(() => {});
    }
  }

  console.log('✅ Seed completado');
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed fallido:', err.message);
  process.exit(1);
});
```

scripts/elasticsearch/index-all.js:

```javascript
const { esClient } = require('../packages/shared-elasticsearch');
const { createMySQLPool } = require('../packages/database-client');

const pool = createMySQLPool({
  host: process.env.MYSQL_HOST || 'mysql',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'uajs_user',
  password: process.env.MYSQL_PASSWORD || 'changeme',
  database: process.env.MYSQL_DATABASE || 'uajs_smart_campus',
});

const indexAll = async () => {
  const tables = [
    { table: 'departamentos', index: 'uajs_catalogs', type: 'departamento' },
    { table: 'ciudades', index: 'uajs_catalogs', type: 'ciudad' },
    { table: 'sedes', index: 'uajs_catalogs', type: 'sede' },
    { table: 'tipos_documento', index: 'uajs_catalogs', type: 'tipo_documento' },
    { table: 'usuarios', index: 'uajs_users', type: 'usuario' },
    { table: 'recursos', index: 'uajs_resources', type: 'recurso' },
    { table: 'reservas', index: 'uajs_bookings', type: 'reserva' },
  ];

  for (const { table, index, type } of tables) {
    const [rows] = await pool.query(`SELECT * FROM ${table}`);

    for (const row of rows) {
      await esClient.client
        .index({
          index,
          id: `${type}_${row.id}`,
          body: { type, ...row },
        })
        .catch(() => {});
    }

    console.log(`✅ Indexed ${rows.length} records from ${table}`);
  }

  console.log('✅ All data indexed');
  process.exit(0);
};

indexAll().catch((err) => {
  console.error('❌ Indexing failed:', err.message);
  process.exit(1);
});
```

PUERTA DE VERIFICACIÓN:

- ✅ Migraciones funcionan
- ✅ Seeds crean datos de prueba
- ✅ Scripts de ES funcionan
- ✅ Tests pasan

```

---

### 🔥 **Prompt 16 — DevOps Productivo Enterprise: Kubernetes + MySQL por Servicio + ECK + GitHub Actions**

**Objetivo:** Implementar el **DevOps Enterprise** con **MySQL dedicado por microservicio** (12 instancias separadas), los 12 manifiestos de Kubernetes (Deployment + Service para cada servicio), ConfigMaps, Secrets, Ingress, **ECK (Elastic Cloud on Kubernetes) para Elasticsearch**, y el pipeline de GitHub Actions (`ci-all.yml`) con **puerta de bloqueo del 80% de cobertura**. Cada microservicio tendrá su propia base de datos MySQL, cumpliendo el principio de **dueño absoluto de datos** (no FOREIGN KEYS entre servicios, solo IDs lógicos, comunicación por API/Eventos).

**Archivos a generar (60 archivos):**

| # | Archivo | Descripción Enterprise |
|---|---------|------------------------|
| 1-12 | `infrastructure/kubernetes/*/deployment.yml` | Deployments con DB dedicada |
| 13-24 | `infrastructure/kubernetes/*/service.yml` | Services |
| 25 | `infrastructure/kubernetes/namespace.yml` | Namespace |
| 26 | `infrastructure/kubernetes/ingress.yml` | Ingress |
| 27 | `infrastructure/kubernetes/configmaps.yml` | ConfigMaps |
| 28 | `infrastructure/kubernetes/secrets.yml` | Secrets |
| 29-40 | `infrastructure/kubernetes/mysql/*/statefulset.yml` | **MySQL por servicio (12 instancias)** |
| 41-52 | `infrastructure/kubernetes/mysql/*/service.yml` | Services MySQL |
| 53 | `infrastructure/kubernetes/mysql/headless-service.yml` | Service headless |
| 54 | `infrastructure/elasticsearch/kubernetes/elasticsearch.yml` | **ECK Elasticsearch** |
| 55 | `infrastructure/elasticsearch/kubernetes/kibana.yml` | **ECK Kibana** |
| 56 | `.github/workflows/ci-all.yml` | Pipeline CI/CD |
| 57 | `.github/workflows/deploy-*.yml` | Deploy workflows |
| 58-60 | Documentación DevOps | Guías y READMEs |

**Instrucciones del prompt:**

```

Eres un Arquitecto de Software Enterprise. Genera código de nivel producción avanzado.

REGLAS DE ORO DE MICROSERVICIOS (APLICADAS EN ESTE PROMPT):

1. **Separación clara:** Cada microservicio tiene su propia base de datos MySQL
2. **Relaciones lógicas, no físicas:** Solo IDs como campos numéricos, SIN FOREIGN KEYS entre servicios
3. **Comunicación por código:** API HTTP o eventos BullMQ, NUNCA JOINs directos

ARQUITECTURA DE BASES DE DATOS:

- api-gateway: NO tiene DB (solo proxy)
- auth-service: db_auth (usuarios, tokens, password_reset)
- user-service: db_users (roles, permisos)
- catalog-service: db_catalog (departamentos, ciudades, sedes, tipos_documento)
- university-service: db_university (empresas, terceros, estudiantes, docentes, facultades, programas)
- resource-service: db_resources (tipos_recursos, recursos, estados_recursos)
- booking-service: db_bookings (tipos_reservas, reservas, estados_reservas)
- request-service: db_requests (tipos_solicitudes, solicitudes, estados_solicitudes, solicitud_historial)
- event-service: db_events (tipos_eventos, eventos, estados_eventos)
- notification-service: db_notifications (tipos_notificaciones, notificaciones, estados_notificaciones)
- pqrs-service: db_pqrs (tipos_pqrs, pqrs, pqrs_respuestas, estados_pqrs)
- storage-service: db_storage (archivos)

KUBERNETES ECK (Elastic Cloud on Kubernetes):

infrastructure/elasticsearch/kubernetes/elasticsearch.yml:

```yaml
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: uajs-elasticsearch
  namespace: uajs-smart-campus
spec:
  version: 8.12.0
  nodeSets:
    - name: default
      count: 3
      config:
        node.roles: [master, data, ingest]
        node.attr.node_type: hot
        xpack.security.enabled: true
        xpack.security.transport.ssl.enabled: true
        xpack.security.http.ssl.enabled: true
      volumeClaimTemplates:
        - metadata:
            name: elasticsearch-data
          spec:
            accessModes: [ReadWriteOnce]
            resources:
              requests:
                storage: 10Gi
  http:
    service:
      spec:
        type: LoadBalancer
    tls:
      selfSignedCertificate:
        disabled: false
  secureSettings:
    - secretName: uajs-elasticsearch-credentials

---
apiVersion: v1
kind: Secret
metadata:
  name: uajs-elasticsearch-credentials
  namespace: uajs-smart-campus
type: Opaque
stringData:
  username: elastic
  password: changeme
```

infrastructure/elasticsearch/kubernetes/kibana.yml:

```yaml
apiVersion: kibana.k8s.elastic.co/v1
kind: Kibana
metadata:
  name: uajs-kibana
  namespace: uajs-smart-campus
spec:
  version: 8.12.0
  count: 1
  elasticsearchRef:
    name: uajs-elasticsearch
  http:
    service:
      spec:
        type: LoadBalancer
    tls:
      selfSignedCertificate:
        disabled: false
  config:
    xpack.security.enabled: true
```

MYSQL POR SERVICIO (StatefulSets):

infrastructure/kubernetes/mysql/auth-service/statefulset.yml:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql-auth-service
  namespace: uajs-smart-campus
  labels:
    app: mysql-auth-service
spec:
  serviceName: mysql-auth-service-headless
  replicas: 1
  selector:
    matchLabels:
      app: mysql-auth-service
  template:
    metadata:
      labels:
        app: mysql-auth-service
    spec:
      containers:
        - name: mysql
          image: mysql:8.0.36
          ports:
            - containerPort: 3306
              name: mysql
          env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secrets
                  key: root-password
            - name: MYSQL_DATABASE
              value: db_auth
            - name: MYSQL_USER
              valueFrom:
                secretKeyRef:
                  name: mysql-secrets
                  key: username
            - name: MYSQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secrets
                  key: password
            - name: TZ
              value: America/Bogota
          volumeMounts:
            - name: mysql-data
              mountPath: /var/lib/mysql
          livenessProbe:
            exec:
              command: ['mysqladmin', 'ping']
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            exec:
              command: ['mysql', '-h', '127.0.0.1', '-e', 'SELECT 1']
            initialDelaySeconds: 5
            periodSeconds: 2
          resources:
            requests:
              memory: '512Mi'
              cpu: '500m'
            limits:
              memory: '1Gi'
              cpu: '1'
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: false
            allowPrivilegeEscalation: false
  volumeClaimTemplates:
    - metadata:
        name: mysql-data
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 5Gi
```

infrastructure/kubernetes/mysql/auth-service/service.yml:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql-auth-service
  namespace: uajs-smart-campus
  labels:
    app: mysql-auth-service
spec:
  selector:
    app: mysql-auth-service
  ports:
    - name: mysql
      port: 3306
      targetPort: 3306
  type: ClusterIP
```

infrastructure/kubernetes/mysql/headless-service.yml:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql-auth-service-headless
  namespace: uajs-smart-campus
  labels:
    app: mysql-auth-service
spec:
  clusterIP: None
  selector:
    app: mysql-auth-service
  ports:
    - port: 3306
      name: mysql
```

KUBERNETES DEPLOYMENTS (con conexión a su DB dedicada):

infrastructure/kubernetes/api-gateway/deployment.yml:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: uajs-smart-campus
  labels:
    app: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
        - name: api-gateway
          image: registry.uajs.edu.co/api-gateway:v2.1
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: 'production'
            - name: PORT
              value: '3000'
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: uajs-secrets
                  key: jwt-secret
            - name: ELASTICSEARCH_HOST
              value: 'elasticsearch'
            - name: ELASTICSEARCH_PORT
              value: '9200'
            - name: ELASTICSEARCH_USER
              valueFrom:
                secretKeyRef:
                  name: uajs-elasticsearch-credentials
                  key: username
            - name: ELASTICSEARCH_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: uajs-elasticsearch-credentials
                  key: password
            - name: AUTH_SERVICE_URL
              value: 'http://auth-service:3001'
            - name: USER_SERVICE_URL
              value: 'http://user-service:3002'
            - name: CATALOG_SERVICE_URL
              value: 'http://catalog-service:3003'
            - name: UNIVERSITY_SERVICE_URL
              value: 'http://university-service:3004'
            - name: RESOURCE_SERVICE_URL
              value: 'http://resource-service:3005'
            - name: BOOKING_SERVICE_URL
              value: 'http://booking-service:3006'
            - name: REQUEST_SERVICE_URL
              value: 'http://request-service:3007'
            - name: EVENT_SERVICE_URL
              value: 'http://event-service:3008'
            - name: NOTIFICATION_SERVICE_URL
              value: 'http://notification-service:3009'
            - name: PQRS_SERVICE_URL
              value: 'http://pqrs-service:3010'
            - name: STORAGE_SERVICE_URL
              value: 'http://storage-service:3011'
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health/liveness
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/readiness
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          securityContext:
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            capabilities:
              drop: ['ALL']
      nodeSelector:
        node-group: high-availability
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values: [api-gateway]
                topologyKey: kubernetes.io/hostname
```

infrastructure/kubernetes/auth-service/deployment.yml:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: uajs-smart-campus
  labels:
    app: auth-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
        - name: auth-service
          image: registry.uajs.edu.co/auth-service:v2.1
          ports:
            - containerPort: 3001
          env:
            - name: NODE_ENV
              value: 'production'
            - name: PORT
              value: '3001'
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: uajs-secrets
                  key: jwt-secret
            - name: JWT_REFRESH_SECRET
              valueFrom:
                secretKeyRef:
                  name: uajs-secrets
                  key: jwt-refresh-secret
            - name: BCRYPT_ROUNDS
              value: '12'
            # Conexión a SU base de datos dedicada
            - name: MYSQL_HOST
              value: 'mysql-auth-service'
            - name: MYSQL_PORT
              value: '3306'
            - name: MYSQL_USER
              valueFrom:
                secretKeyRef:
                  name: mysql-secrets
                  key: username
            - name: MYSQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secrets
                  key: password
            - name: MYSQL_DATABASE
              value: 'db_auth'
            # Redis compartido para colas
            - name: REDIS_HOST
              value: 'redis'
            - name: REDIS_PORT
              value: '6379'
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: redis-secrets
                  key: password
            # Elasticsearch
            - name: ELASTICSEARCH_HOST
              value: 'elasticsearch'
            - name: ELASTICSEARCH_PORT
              value: '9200'
            - name: ELASTICSEARCH_USER
              valueFrom:
                secretKeyRef:
                  name: uajs-elasticsearch-credentials
                  key: username
            - name: ELASTICSEARCH_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: uajs-elasticsearch-credentials
                  key: password
            - name: AUTH_EVENTS_INDEX
              value: 'uajs_auth_events'
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
          securityContext:
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            capabilities:
              drop: ['ALL']
```

GITHUB ACTIONS (CI/CD con pruebas de integración entre servicios):

.github/workflows/ci-all.yml:

```yaml
name: CI - All Services

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    name: Test All Services
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          [
            api-gateway,
            auth-service,
            user-service,
            catalog-service,
            university-service,
            resource-service,
            booking-service,
            request-service,
            event-service,
            notification-service,
            pqrs-service,
            storage-service,
          ]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: |
          cd apps/${{ matrix.service }}
          npm ci

      - name: Run lint
        run: |
          cd apps/${{ matrix.service }}
          npm run lint

      - name: Run tests with coverage
        run: |
          cd apps/${{ matrix.service }}
          npm test -- --coverage

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ matrix.service }}
          path: apps/${{ matrix.service }}/coverage/

  integration-tests:
    name: Integration Tests
    needs: test
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7.2-alpine
        ports:
          - 6379:6379
      mysql-auth:
        image: mysql:8.0.36
        env:
          MYSQL_ROOT_PASSWORD: test123
          MYSQL_DATABASE: db_auth
        ports:
          - 3306:3306
      mysql-users:
        image: mysql:8.0.36
        env:
          MYSQL_ROOT_PASSWORD: test123
          MYSQL_DATABASE: db_users
        ports:
          - 3307:3306
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Test API Gateway -> Auth Service
        run: |
          cd apps/api-gateway
          npm ci
          # Iniciar auth-service en segundo plano
          cd ../auth-service
          npm ci
          nohup node src/server.js > /tmp/auth-service.log 2>&1 &
          sleep 5
          # Probar que gateway proxy a auth-service
          curl -X POST http://localhost:3000/api/v1/auth/health -H "Content-Type: application/json"

      - name: Test Auth Service -> User Service (API Call, NO JOIN)
        run: |
          # Verificar que auth-service consulta user-service por HTTP
          # NO por JOIN en la base de datos
          curl -X GET http://localhost:3001/api/v1/auth/test-user -H "Authorization: Bearer test_token"

  coverage-gate:
    name: Coverage Gate
    needs: [test, integration-tests]
    runs-on: ubuntu-latest
    steps:
      - name: Download all coverage reports
        uses: actions/download-artifact@v4
        with:
          path: coverage-reports

      - name: Check coverage threshold
        run: |
          # Verificar que todos los servicios tienen > 80% coverage
          for dir in coverage-reports/coverage-*; do
            if [ -f "$dir/lcov.info" ]; then
              coverage=$(grep -oP '\d+(?=\%)' "$dir/lcov.info" | head -1)
              if [ "$coverage" -lt 80 ]; then
                echo "❌ Coverage below 80% for ${dir##*/}"
                exit 1
              fi
              echo "✅ Coverage ${coverage}% for ${dir##*/}"
            fi
          done

  deploy-staging:
    name: Deploy to Staging
    needs: coverage-gate
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.uajs-smart-campus.edu.co
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker images
        run: |
          docker login -u ${{ secrets.DOCKER_USERNAME }} -p ${{ secrets.DOCKER_PASSWORD }} registry.uajs.edu.co

          for service in apps/*/; do
            service_name=$(basename "$service")
            docker build -t registry.uajs.edu.co/${service_name}:v2.1 -f "${service}Dockerfile" .
            docker push registry.uajs.edu.co/${service_name}:v2.1
          done

      - name: Deploy MySQL instances
        run: |
          echo "${{ secrets.KUBE_CONFIG }}" > kubeconfig.yaml
          export KUBECONFIG=kubeconfig.yaml

          # Desplegar MySQL para cada servicio
          kubectl apply -f infrastructure/kubernetes/mysql/

          # Esperar a que todos los MySQL estén listos
          kubectl wait --for=condition=ready pod -l app=mysql-auth-service -n uajs-smart-campus --timeout=300s
          kubectl wait --for=condition=ready pod -l app=mysql-user-service -n uajs-smart-campus --timeout=300s
          kubectl wait --for=condition=ready pod -l app=mysql-catalog-service -n uajs-smart-campus --timeout=300s
          # ... (para todos los servicios)

      - name: Deploy Elasticsearch ECK
        run: |
          kubectl apply -f infrastructure/elasticsearch/kubernetes/
          kubectl wait --for=condition=ready pod -l elasticsearch.k8s.elastic.co/cluster-name=uajs-elasticsearch -n uajs-smart-campus --timeout=600s

      - name: Deploy Services
        run: |
          kubectl apply -f infrastructure/kubernetes/namespace.yml
          kubectl apply -f infrastructure/kubernetes/configmaps.yml
          kubectl apply -f infrastructure/kubernetes/secrets.yml
          kubectl apply -f infrastructure/kubernetes/

          # Esperar a que todos los pods estén listos
          kubectl wait --for=condition=ready pod --all -n uajs-smart-campus --timeout=300s

  deploy-production:
    name: Deploy to Production
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://uajs-smart-campus.edu.co
    steps:
      - uses: actions/checkout@v4

      - name: Build and push Docker images (production)
        run: |
          docker login -u ${{ secrets.DOCKER_USERNAME }} -p ${{ secrets.DOCKER_PASSWORD }} registry.uajs.edu.co

          for service in apps/*/; do
            service_name=$(basename "$service")
            docker build -t registry.uajs.edu.co/${service_name}:v2.1-prod -f "${service}Dockerfile" .
            docker push registry.uajs.edu.co/${service_name}:v2.1-prod
          done

      - name: Deploy to Kubernetes (Production)
        run: |
          echo "${{ secrets.KUBE_CONFIG_PROD }}" > kubeconfig.yaml
          export KUBECONFIG=kubeconfig.yaml

          kubectl apply -f infrastructure/kubernetes/namespace.yml
          kubectl apply -f infrastructure/kubernetes/configmaps.yml
          kubectl apply -f infrastructure/kubernetes/secrets.yml
          kubectl apply -f infrastructure/kubernetes/mysql/
          kubectl apply -f infrastructure/elasticsearch/kubernetes/
          kubectl apply -f infrastructure/kubernetes/

          # Verificar despliegue
          kubectl rollout status deployment -n uajs-smart-campus --timeout=300s
          kubectl get pods -n uajs-smart-campus
```

PUERTA DE VERIFICACIÓN:

- ✅ **12 instancias MySQL separadas** (una por microservicio)
- ✅ **Ningún FOREIGN KEY entre tablas de distintos servicios**
- ✅ **Comunicación solo por API HTTP o eventos BullMQ** (NUNCA JOINs directos)
- ✅ Todos los deployments de Kubernetes funcionan
- ✅ ECK (Elasticsearch) desplegado correctamente
- ✅ Pipeline CI/CD funciona con pruebas de integración
- ✅ Coverage gate bloquea si < 80%
- ✅ Despliegue a staging y producción funciona
- ✅ **Cada microservicio es dueño absoluto de sus datos**

```

---

## 🚀 **Resumen Final Enterprise**

### 🎯 **Patrones Enterprise Implementados en Todos los Prompts**

1. **Resiliencia Avanzada:**
   - Circuit Breaker con Opossum
   - Retry con backoff exponencial
   - Fallback automático
   - Timeout y Bulkhead patterns

2. **Seguridad Enterprise:**
   - TLS mutuo para Elasticsearch
   - API Keys y RBAC
   - IP Filtering
   - JWT con TTL estrictos
   - Service Tokens para comunicación interna

3. **Escalabilidad:**
   - Pool de conexiones MySQL/Redis/ES
   - Bulk Processing para indexado masivo
   - Sharding y replicación
   - Horizontal Pod Autoscaling en Kubernetes

4. **Observabilidad Completa:**
   - Structured Logging con correlation IDs
   - Métricas Prometheus
   - Health checks profundos
   - Alertas y SLOs

5. **Mantenibilidad:**
   - Code Quality con ESLint/Prettier
   - Testing completo (Unit + Integration + E2E)
   - Documentación OpenAPI
   - Versionado semántico

6. **Rendimiento:**
   - Caché en Redis
   - Indexación optimizada en ES
   - Consultas eficientes con aggregations
   - Search Templates reutilizables

7. **Integración Elasticsearch Enterprise:**
   - Index Lifecycle Management (ILM)
   - Index Templates
   - Dynamic Mappings
   - Bulk Processing
   - Async Queue para indexado

### 📊 **Métricas del Proyecto**

| Métrica | Valor |
|---------|-------|
| **Total de Carpetas** | 295 |
| **Total de Archivos** | 772 |
| **Total de Elementos** | **1,067** |
| **Servicios** | 12 (1 Gateway + 11 Microservicios) |
| **Paquetes Compartidos** | 4 (database-client, shared-utils, shared-types, shared-elasticsearch) |
| **Nivel de Calidad** | **Enterprise/Architect Grade** |
| **Cobertura Mínima** | 80% |
| **Stack Tecnológico** | Node.js 20 + Express + MySQL 8 + Redis + Elasticsearch 8.12 + Kubernetes ECK |

### ✅ **Checklist de Verificación Final**

- [ ] Todos los 16 prompts generados con nivel Enterprise
- [ ] 295 carpetas creadas
- [ ] 772 archivos generados
- [ ] Integración completa con Elasticsearch
- [ ] Patrones de resiliencia en todos los servicios
- [ ] Seguridad Enterprise implementada
- [ ] Observabilidad completa (Logging + Métricas + Trazabilidad)
- [ ] Kubernetes ECK configurado
- [ ] Pipeline CI/CD con coverage gate
- [ ] Documentación completa
- [ ] Tests pasan en todos los servicios
- [ ] Coverage > 80% en todos los servicios

---

**Nota Final:** Este documento representa el **nivel Enterprise/Architect Grade** más alto para UAJS Smart Campus v2.1 con integración completa de Elasticsearch. Todos los prompts han sido diseñados con patrones de producción avanzados, resiliencia, seguridad y observabilidad completas, superando ampliamente el nivel Senior.
```
