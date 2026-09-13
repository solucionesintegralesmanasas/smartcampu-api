# Storage Service

Servicio de almacenamiento Enterprise para el monorepo UAJS Smart Campus. Proporciona subida segura de archivos con validación estricta, renombrado por UUID y indexación de metadata en Elasticsearch para búsqueda full-text.

## Características

- **Subida segura** con Multer y validación estricta de extensiones (PDF, JPG, JPEG, PNG, GIF)
- **Límite de tamaño** configurable (por defecto 10MB)
- **Renombrado automático** por UUID para evitar colisiones
- **Almacenamiento de metadata** en MySQL con soft delete
- **Indexación en Elasticsearch** para búsqueda full-text y filtros
- **Colas BullMQ** para procesamiento asíncrono de indexación
- **API REST** documentada con OpenAPI/Swagger
- **Rate limiting**, Helmet, CORS configurados

## Arquitectura

```
src/
├── config/           # Configuración (env, logger, ES, DB, queues)
├── core/
│   ├── exceptions/   # Errores personalizados (AppError, ValidationError, etc.)
│   ├── loaders/      # Loaders de Express y base de datos
│   └── helpers/      # Utilidades (paginación)
├── modules/
│   └── archivo/      # Módulo principal (CRUD + upload)
├── jobs/
│   ├── producers/    # Productores BullMQ
│   └── consumers/    # Consumidores BullMQ
├── docs/             # Swagger/OpenAPI
├── app.js            # Inicialización Express
└── server.js         # Entry point con graceful shutdown
```

## Requisitos

- Node.js >= 20
- MySQL 8
- Redis 7
- Elasticsearch 8.12

## Instalación

```bash
# Desde la raíz del monorepo
npm install

# Variables de entorno
cp apps/storage-service/.env.example apps/storage-service/.env
# Editar .env con valores reales
```

## Desarrollo

```bash
# Iniciar infraestructura (MySQL, Redis, ES)
npm run docker:up

# Ejecutar servicio
cd apps/storage-service && npm run dev

# Ver Swagger UI
# http://localhost:3011/api-docs
```

## Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/storage/upload` | Subir archivo (multipart/form-data) |
| GET | `/api/v1/storage/search?q=termino` | Buscar en Elasticsearch |
| GET | `/api/v1/storage` | Listar archivos paginados |
| GET | `/api/v1/storage/:id` | Obtener por ID |
| GET | `/api/v1/storage/uuid/:uuid` | Obtener por UUID |
| PATCH | `/api/v1/storage/:id` | Actualizar metadata |
| DELETE | `/api/v1/storage/:id` | Eliminar (soft delete) |

### Subir archivo

```bash
curl -X POST http://localhost:3011/api/v1/storage/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@documento.pdf" \
  -F "entidadAsociada=evento" \
  -F "uuidAsociado=550e8400-e29b-41d4-a716-446655440000" \
  -F "carpeta=documentos" \
  -F "publico=false"
```

### Buscar archivos

```bash
curl "http://localhost:3011/api/v1/storage/search?q=contrato&tipo=application/pdf&limit=10" \
  -H "Authorization: Bearer <token>"
```

## Validaciones

- **Extensiones permitidas**: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.gif`
- **Tamaño máximo**: 10MB (configurable via `MAX_FILE_SIZE`)
- **Metadata opcional**: `entidadAsociada`, `uuidAsociado`, `carpeta`, `publico`

## Indexación Elasticsearch

Los archivos se indexan automáticamente en el índice `uajs_storage` con mapping estricto:

- Búsqueda full-text en `nombre_original`, `nombre_sistema`, `carpeta`
- Filtros por `subido_por`, `mime_type`, `entidad_asociada`, `activo`
- Ordenamiento por `createdAt` descendente

## Colas BullMQ

Cola: `storage_jobs`

| Job | Descripción |
|-----|-------------|
| `index_file` | Indexar nuevo archivo en ES |
| `update_file` | Actualizar documento en ES |
| `delete_file` | Eliminar de ES |
| `bulk_process` | Procesamiento en lote |

## Tests

```bash
cd apps/storage-service
npm run test:unit
npm run test:e2e
npm run test:coverage
```

## Docker

```bash
# Build
docker build -t storage-service -f apps/storage-service/Dockerfile .

# Run
docker run -p 3011:3011 --env-file apps/storage-service/.env storage-service
```

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servicio | 3011 |
| `MYSQL_HOST` | Host MySQL | mysql |
| `MYSQL_DATABASE` | Base de datos | uajs_storage |
| `REDIS_HOST` | Host Redis | redis |
| `ELASTICSEARCH_HOST` | Host ES | elasticsearch |
| `STORAGE_INDEX` | Índice ES | uajs_storage |
| `MAX_FILE_SIZE` | Tamaño máx (bytes) | 10485760 |
| `UPLOAD_DIR` | Directorio uploads | /uploads |

## Licencia

MIT - UAJS Team