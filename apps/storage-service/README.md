# storage-service

Almacenamiento de archivos adjuntos (PQRS, solicitudes, eventos, perfil).
Solo PDF/JPG/JPEG/PNG/GIF, máximo 10MB por defecto (`STORAGE_MAX_SIZE`).

## Diseño: metadata en MySQL, contenido en un driver de storage

La tabla `files` (base propia `uajs_storage`,
`scripts/migrations/ms-storage_001_init.sql`) solo guarda metadata — nombre
original, nombre generado, tamaño, checksum SHA-256, dueño. El contenido
binario lo maneja `src/config/storage.js` a través de un driver
intercambiable:

- **`local`** (por defecto): guarda en disco bajo `STORAGE_PATH` (relativo a
  la raíz del servicio si no es una ruta absoluta). En Docker, `STORAGE_PATH`
  debe montarse como volumen persistente o los archivos se pierden al
  recrear el contenedor.
- Agregar otro driver (p. ej. `s3`) solo requiere implementar la misma
  interfaz (`save`/`read`/`createReadStream`/`delete`) y registrarlo en
  `drivers` — el resto del servicio no cambia.

El nombre con el que se guarda un archivo en disco (`stored_name`) **siempre**
lo genera el servidor (UUID + extensión), nunca el nombre original del
cliente, para eliminar cualquier riesgo de path traversal.

## Autorización

Cualquier usuario autenticado puede subir archivos (queda como dueño vía
`owner_user_uuid`, el `uuid` de auth-service). Ver/descargar/borrar un
archivo requiere ser el dueño o tener rol `SUPERADMIN`/`ADMIN`/`STAFF`. Listar
(`GET /archivos`) para un usuario normal siempre se filtra a sus propios
archivos, ignorando cualquier intento de listar los de otro.

## Variables de entorno

Ver `.env.example`. `SERVICE_AUTH_TOKEN` debe coincidir con el del
api-gateway y el resto de servicios.
