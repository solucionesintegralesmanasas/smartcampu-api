# Índice de documentación por módulo y carpeta

> Detalle carpeta por carpeta de lo que funciona correctamente. Cada archivo cubre `src/` completo: raíz, `config/`, `core/`, `modules/`, `jobs/`, `docs/` y `tests/`.

## Archivos

- `api-gateway.md`: `app.js`, `server.js`, `config/env|logger|elasticsearch`, `core/rateLimiter/tokenBucket`, `middleware/` 7 archivos, `routes/health|index`, `tests/unit+e2e`.
- `auth-service.md`: raíz, `config/env|logger|elasticsearch|queues|database/mysql|redis`, `core/loaders|helpers|exceptions`, `modules/auth/` 6 archivos, `jobs/producers/email|auth + consumers/email`, `docs/swagger`, `tests/unit+e2e+http`.
- `catalog-service.md`: raíz, `config/env|logger|elasticsearch|queues`, `core/exceptions|loaders|helpers`, `modules/department|city|campus|document-type/` 5 archivos cada uno, `jobs/producer|consumer`, `docs/swagger 276`, `tests/setup+http` sin `*.test.js`.
- `university-service.md`: raíz, `config/env|logger|elasticsearch|queues|database/mysql|redis`, `core/loaders|exceptions|helpers|services/user-provisioning`, `modules/empresa|tercero|facultad|programa|estudiante|docente/` 5 archivos cada uno, `jobs/producer|consumer` dual, `docs/swagger 847`, `tests/unit 14+e2e+http 307`.
- `storage-service.md`: raíz, `config/env|logger|elasticsearch|queues|database/mysql|redis`, `core/exceptions|loaders|helpers`, `modules/archivo/` 5 archivos con multer y uuid, `jobs/producer|consumer`, `docs/swagger 469`, `tests/unit 7+e2e`.

## Análisis de lo entregado antes

- `docs/SERVICIOS_FUNCIONALES.md`: visión general, tabla 12 servicios, arquitectura, tablas de endpoints por servicio, infraestructura, verificación y brechas.
- Esta carpeta `docs/modulos/`: baja a nivel archivo, con propósito, exportaciones, métodos, esquemas Zod, claves Redis, índices ES, colas BullMQ y ejemplos de uso.
- Lo no documentado con detalle de uso: `user, resource, booking, request, event, notification, pqrs` por ser andamios con solo `.gitkeep`.

## Cómo leer

1. Empieza por `SERVICIOS_FUNCIONALES.md` para estado y puertos.
2. Luego el archivo del servicio en esta carpeta para cada carpeta y cada fichero.
3. Usa las colecciones `.http` y los ejemplos `curl` al final de cada archivo para probar.
