# Servicio Universitario Enterprise (`university-service`)

Microservicio **Enterprise Grade** encargado de la gestión académica estructural de la Universidad Autónoma Juan de Santander (UAJS), incluyendo empresas de convenio, registro maestro de personas/terceros, facultades, programas académicos, estudiantes matriculados y personal docente.

Cuenta con soporte para:

- **CRUD transaccional** en MySQL con validaciones estrictas de integridad referencial.
- **Indexación automática y en tiempo real** de documentos en el índice `uajs_university` de Elasticsearch.
- **Búsqueda avanzada full-text** con analizador en español (`spanish`).
- **Caché distribuida** de alto rendimiento en Redis con invalidación automática de colecciones y recursos individuales.
- **Procesamiento asíncrono y resiliente** de eventos e indexación mediante colas BullMQ.
- **Documentación interactiva OpenAPI 3.0** servida mediante Swagger UI.

---

## 🏗️ Arquitectura del Servicio

El servicio implementa la arquitectura en capas desacoplada del monorepo Smart Campus:

```
src/
├── config/                  # Configuraciones (env, logger, ES, MySQL, Redis, BullMQ)
│   ├── database/            # Conexiones MySQL y Redis con circuit breaker
│   ├── elasticsearch.js     # Cliente resiliente de ES e índice uajs_university
│   ├── env.js               # Validación de entorno con Zod
│   ├── logger.js            # Winston logger con transporte Elasticsearch
│   └── queues.js            # Colas y Workers BullMQ
├── core/
│   ├── exceptions/          # Jerarquía de errores (AppError, NotFound, Validation, Conflict)
│   ├── helpers/             # Helpers reutilizables (paginación)
│   └── loaders/             # Inicializadores de Express y Base de Datos / ES
├── docs/                    # OpenAPI 3.0 (swagger.yaml y swagger.config.js)
├── jobs/
│   ├── consumers/           # UniversityConsumer (procesador de eventos ES)
│   └── producers/           # UniversityProducer (productor de eventos asíncronos)
├── modules/
│   ├── docente/             # Módulo de Docentes (controller, service, repository, validation, routes)
│   ├── empresa/             # Módulo de Empresas externas / convenios
│   ├── estudiante/          # Módulo de Estudiantes matriculados
│   ├── facultad/            # Módulo de Facultades académicas
│   ├── programa/            # Módulo de Programas académicos (pregrado, posgrados)
│   └── tercero/             # Módulo maestro de Personas / Terceros
├── app.js                   # Configuración de Express
└── server.js                # Arranque y apagado controlado (graceful shutdown)
```

---

## 🗄️ Modelo de Datos y Entidades

| Entidad        | Tabla MySQL | Descripción                                      | Índice ES (`type`) |
| -------------- | ----------- | ------------------------------------------------ | ------------------ |
| **Empresa**    | `companies` | Empresas externas para pasantías y convenios     | `empresa`          |
| **Tercero**    | `persons`   | Registro maestro unificado de personas naturales | `tercero`          |
| **Facultad**   | `faculties` | Facultades académicas organizadas por sede       | `facultad`         |
| **Programa**   | `programs`  | Programas académicos de pregrado y posgrados     | `programa`         |
| **Estudiante** | `students`  | Matrícula y ficha académica del estudiante       | `estudiante`       |
| **Docente**    | `teachers`  | Vinculación académica y contractual del profesor | `docente`          |

---

## 🔍 Indexación y Búsqueda en Elasticsearch

El índice `uajs_university` se inicializa de forma no bloqueante con mappings estrictos para soportar búsquedas relacionales y full-text:

- **Estructura relacional anidada (`relaciones`)**: almacena asociaciones hacia entidades padre o vinculadas (`empresa`, `facultad`, `programa`, `tercero`).
- **Analizador español**: habilita stemmer y normalización léxica en campos de texto (`nombre`).
- **Búsqueda por multi-match**: permite coincidencias por texto libre, código y documento.

### Ejemplo de documento indexado (`tercero`):

```json
{
  "type": "tercero",
  "id": 10,
  "nombre": "Carlos Alberto Rodríguez",
  "codigo": "1098765432",
  "estado": "ACTIVO",
  "numeroDocumento": "1098765432",
  "email": "carlos.rodriguez@uajs.edu.co",
  "relaciones": [
    {
      "type": "empresa",
      "id": 2,
      "nombre": "Tech Solutions S.A.S."
    }
  ]
}
```

---

## 🚀 Endpoints Principales

Todos los endpoints se encuentran prefijados por `/api/v1/universidad` (y su alias compatible `/api/v1/university`):

### Empresas (`/empresas`)

- `GET /api/v1/universidad/empresas` — Lista paginada de empresas.
- `GET /api/v1/universidad/empresas/search?search={query}` — Búsqueda en Elasticsearch.
- `GET /api/v1/universidad/empresas/:id` — Obtener por ID o UUID.
- `POST /api/v1/universidad/empresas` — Crear empresa.
- `PUT /api/v1/universidad/empresas/:id` — Actualizar datos.
- `DELETE /api/v1/universidad/empresas/:id` — Eliminación con validación de no existencia de terceros asociados.

### Terceros (`/terceros`)

- `GET /api/v1/universidad/terceros` — Lista paginada con filtros.
- `GET /api/v1/universidad/terceros/search?search={query}` — Búsqueda full-text en Elasticsearch.
- `GET /api/v1/universidad/terceros/:id` — Obtener tercero por ID.
- `POST /api/v1/universidad/terceros` — Crear persona natural.
- `PUT /api/v1/universidad/terceros/:id` — Actualizar tercero.
- `DELETE /api/v1/universidad/terceros/:id` — Eliminación protegida contra dependencias académicas.

### Facultades (`/facultades`)

- `GET /api/v1/universidad/facultades` — Lista de facultades.
- `GET /api/v1/universidad/facultades/search?search={query}` — Búsqueda en Elasticsearch.
- `GET /api/v1/universidad/facultades/:id` — Detalle de facultad.
- `POST /api/v1/universidad/facultades` — Crear facultad.
- `PUT /api/v1/universidad/facultades/:id` — Modificar facultad.
- `DELETE /api/v1/universidad/facultades/:id` — Eliminación protegida (valida programas y docentes asociados).

### Programas (`/programas`)

- `GET /api/v1/universidad/programas` — Lista de programas académicos.
- `GET /api/v1/universidad/programas/search?search={query}` — Búsqueda en Elasticsearch.
- `GET /api/v1/universidad/programas/:id` — Detalle del programa.
- `POST /api/v1/universidad/programas` — Crear programa validando existencia de facultad.
- `PUT /api/v1/universidad/programas/:id` — Actualizar programa.
- `DELETE /api/v1/universidad/programas/:id` — Eliminación protegida (valida estudiantes matriculados).

### Estudiantes (`/estudiantes`)

- `GET /api/v1/universidad/estudiantes` — Listar estudiantes matriculados.
- `GET /api/v1/universidad/estudiantes/search?search={query}` — Búsqueda en Elasticsearch.
- `GET /api/v1/universidad/estudiantes/:id` — Detalle de estudiante.
- `POST /api/v1/universidad/estudiantes` — Matricular estudiante validando persona y programa.
- `PUT /api/v1/universidad/estudiantes/:id` — Actualizar historial o estado.
- `DELETE /api/v1/universidad/estudiantes/:id` — Retiro suave (soft delete).

### Docentes (`/docentes`)

- `GET /api/v1/universidad/docentes` — Listar personal docente.
- `GET /api/v1/universidad/docentes/search?search={query}` — Búsqueda en Elasticsearch.
- `GET /api/v1/universidad/docentes/:id` — Detalle del docente.
- `POST /api/v1/universidad/docentes` — Vincular docente validando persona y facultad.
- `PUT /api/v1/universidad/docentes/:id` — Actualizar contrato o título.
- `DELETE /api/v1/universidad/docentes/:id` — Desvinculación suave (soft delete).

### Documentación y Monitoreo

- `GET /api/docs` — Swagger UI OpenAPI 3.0 interactivo.
- `GET /api/v1/universidad/health` o `/healthz` — Verificación de salud del servicio.

---

## 🧪 Pruebas Automatizadas

```bash
# Ejecutar todas las pruebas del servicio universitario
npm run test

# Pruebas unitarias
npm run test:unit

# Pruebas de integración / e2e
npm run test:e2e

# Cobertura de código (> 80% requerido)
npm run test:coverage
```
