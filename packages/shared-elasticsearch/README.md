# @uajs/shared-elasticsearch

Paquete compartido de Elasticsearch para el monorepo UAJS Smart Campus v2.1.

## Instalación

Este paquete se instala automáticamente via workspaces del monorepo.

## Uso

```javascript
const {
  createElasticsearchClient,
  createIndex,
  mappings,
  queries,
  utils,
} = require('@uajs/shared-elasticsearch');

// Crear cliente
const client = createElasticsearchClient({
  host: process.env.ELASTICSEARCH_HOST || 'elasticsearch',
  port: process.env.ELASTICSEARCH_PORT || '9200',
  user: process.env.ELASTICSEARCH_USER || 'elastic',
  password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
});

// Crear índice con mapping
await createIndex(client, 'uajs_users', mappings.user);

// Indexar documento
await utils.indexHelper.indexDocument(client, 'uajs_users', userUuid, userData);

// Buscar usuarios
const results = await queries.user.searchUsers(client, { query: { match_all: {} } });
```

## Estructura

```
src/
├── client.js          # Cliente ES y constantes de índices
├── mappings/          # Mapeos por dominio (12 archivos)
│   ├── user.mapping.js
│   ├── event.mapping.js
│   ├── resource.mapping.js
│   ├── booking.mapping.js
│   ├── catalog.mapping.js
│   ├── university.mapping.js
│   ├── request.mapping.js
│   ├── notification.mapping.js
│   ├── pqrs.mapping.js
│   ├── storage.mapping.js
│   ├── auth.mapping.js
│   └── gateway.mapping.js
├── queries/           # Consultas predefinidas (5 archivos)
│   ├── logs.queries.js
│   ├── user.queries.js
│   ├── event.queries.js
│   ├── resource.queries.js
│   └── booking.queries.js
└── utils/             # Utilidades (3 archivos)
    ├── logger.js      # Logging a ES
    ├── errorHandler.js
    └── indexHelper.js # CRUD de documentos
```

## Índices

| Índice               | Descripción                     |
| -------------------- | ------------------------------- |
| `uajs_users`         | Usuarios, roles, permisos       |
| `uajs_logs-*`        | Logs diarios (por fecha)        |
| `uajs_events`        | Eventos institucionales         |
| `uajs_resources`     | Recursos (aulas, labs, etc.)    |
| `uajs_bookings`      | Reservas                        |
| `uajs_catalogs`      | Catálogos                       |
| `uajs_university`    | Terceros, estudiantes, docentes |
| `uajs_requests`      | Solicitudes                     |
| `uajs_notifications` | Notificaciones                  |
| `uajs_pqrs`          | PQRS                            |
| `uajs_storage`       | Archivos                        |
| `uajs_auth`          | Logs de autenticación           |
| `uajs_gateway`       | Logs del gateway                |
