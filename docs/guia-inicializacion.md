# Guía de inicialización — UAJS Smart Campus

**Objetivo:** dejar el entorno de desarrollo con MySQL 8, Redis y las 10 bases de datos por microservicio creadas, migradas y con datos semilla, y verificar que todo quedó correcto.

**Alcance:** esta guía cubre la infraestructura de datos (MySQL, Redis), las variables de entorno, las migraciones, las semillas y la verificación. Los pasos para levantar los microservicios están al final, como paso opcional.

**Última revisión:** 2026-10-24

---

## 0. Requisitos previos

| Herramienta | Versión mínima | Cómo verificar |
| --- | --- | --- |
| Docker Desktop (Docker Engine + Compose v2) | Engine 20.10+, Compose 2.0+ | `docker --version` y `docker compose version` |
| Node.js | 20.x | `node -v` |
| npm | 10.x | `npm -v` |
| Git | cualquiera reciente | `git --version` |
| Git Bash o WSL (recomendado para los comandos de redirección `<`) | — | Abrir Git Bash y ejecutar `bash --version` |

Todos los comandos de esta guía se ejecutan **desde la raíz del repositorio**:

```
C:\xampp\htdocs\smartcampu\smartcampu-api
```

> **Nota sobre la terminal:** en PowerShell no funciona la redirección `<`. Por eso cada paso que importa archivos SQL tiene dos variantes: **Bash** (Git Bash o WSL) y **PowerShell**. Usa la que corresponda a tu terminal.

---

## 1. Dependencias del monorepo

```
npm install
```

**Resultado esperado:** termina sin errores. Al final se instala el hook de Husky porque el repositorio tiene carpeta `.git`.

---

## 2. Configurar las variables de entorno

### 2.1 Crear el archivo `.env` de Docker

Docker Compose lee automáticamente un archivo `.env` que esté en el mismo directorio que `docker-compose.yml`. Crea el archivo:

**Ruta:** `infrastructure/docker/.env`

**Contenido:**

```env
MYSQL_ROOT_PASSWORD=uajs206**
MYSQL_USER=uajs_user
MYSQL_PASSWORD=uajs206**
JWT_SECRET=uajs_dev_jwt_secret_1234567890abcdefghijklmnopqrstuvwxyz_extra_long_654321
JWT_ACCESS_SECRET=uajs_dev_jwt_access_secret_abcdefghijklmnopqrstuvwxyz_0123456789_extra
JWT_REFRESH_SECRET=uajs_dev_jwt_refresh_secret_abcdefghijklmnopqrstuvwxyz_9876543210_largo
SERVICE_AUTH_TOKEN=uajs_service_token_2024_change_me_in_prod
ELASTICSEARCH_PASSWORD=changeme
```

> **Importante:** estos valores son de desarrollo. En cualquier entorno compartido cámbialos por valores propios. `JWT_SECRET` debe ser idéntico para el gateway y para `auth-service`, y `SERVICE_AUTH_TOKEN` debe ser igual en todos los servicios.

### 2.2 Validar las plantillas de entorno

```
npm run validate:env
```

**Resultado esperado:**

```
  .env.example es valido
  .env.development: no existe, se omite
  .env.staging: no existe, se omite
  .env.production: no existe, se omite
Todos los archivos de entorno son validos
```

Si aparece un error, revisa que `SERVICE_AUTH_TOKEN` tenga al menos 32 caracteres, que `ELASTICSEARCH_PASSWORD` tenga al menos 8 caracteres y que los secretos JWT tengan al menos 32 caracteres cada uno.

### 2.3 Archivos `.env` por servicio (solo para ejecución sin Docker)

Si vas a ejecutar un microservicio directamente con Node (sin contenedores), cada servicio necesita su propio `.env`. Copia la plantilla correspondiente:

```
copy apps\auth-service\.env.example apps\auth-service\.env
```

No es necesario para el flujo de Docker de esta guía, porque Compose inyecta las variables de cada servicio.

---

## 3. Levantar MySQL y Redis

Levanta solo los contenedores de datos:

```
docker compose -f infrastructure/docker/docker-compose.yml up -d mysql redis
```

**Resultado esperado:** Docker descarga las imágenes `mysql:8.0` y `redis:7-alpine` (solo la primera vez) y crea los contenedores `uajs-mysql` y `uajs-redis`.

### 3.1 Esperar a que estén saludables

```
docker compose -f infrastructure/docker/docker-compose.yml ps
```

**Resultado esperado:** las columnas `STATUS` de `uajs-mysql` y `uajs-redis` muestran `(healthy)`. MySQL puede tardar entre 30 y 60 segundos la primera vez, porque el contenedor inicializa el servidor y después ejecuta los scripts de `init`.

Si después de dos minutos sigue en `starting`, revisa la sección 9 (solución de problemas).

---

## 4. Migraciones (creación de esquemas)

### 4.1 Aplicación automática en el primer arranque

Al crear el contenedor de MySQL por primera vez, Docker ejecuta el script `infrastructure/docker/init/init-databases.sh`. Ese script:

1. Aplica en orden alfabético cada archivo `scripts/migrations/ms-*_001_init.sql` (10 archivos).
2. Otorga al usuario `uajs_user` permisos sobre cada base `uajs_*`.

Revisa los logs para confirmar la ejecución:

```
docker logs uajs-mysql 2>&1 | findstr "==>"
```

En Bash, usa `grep`:

```bash
docker logs uajs-mysql 2>&1 | grep "==>"
```

**Resultado esperado:** diez líneas `==> Aplicando migración: ms-<servicio>_001_init.sql` seguidas de `==> ✓ ... aplicada`, y al final `==> Inicialización de bases de datos completada.`

> **Limitación:** este script solo se ejecuta si el volumen `mysql_data` está vacío. Si el volumen ya existía, no hay log de migraciones. Pasa a la sección 4.2 para aplicarlas manualmente.

### 4.2 Aplicación manual (solo si la automática no corrió)

Las migraciones son idempotentes (`CREATE DATABASE IF NOT EXISTS` y `CREATE TABLE IF NOT EXISTS`), así que es seguro ejecutarlas de nuevo.

**Bash (Git Bash o WSL):**

```bash
for f in scripts/migrations/ms-*_001_init.sql; do
  echo "Aplicando $f"
  docker exec -i uajs-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4' < "$f"
done
```

**PowerShell:** reemplaza `uajs206**` por el valor de `MYSQL_ROOT_PASSWORD` si lo cambiaste.

```powershell
$OutputEncoding = [System.Text.Encoding]::UTF8
Get-ChildItem scripts\migrations -Filter 'ms-*_001_init.sql' | Sort-Object Name | ForEach-Object {
  Write-Host "Aplicando $($_.Name)"
  Get-Content -Raw -Encoding utf8 $_.FullName | docker exec -i uajs-mysql mysql -uroot -puajs206** --default-character-set=utf8mb4
}
```

**Resultado esperado:** la ejecución termina sin mensajes `ERROR`. Los pasos de verificación de la sección 6 confirman que las bases y tablas existen.

---

## 5. Semillas (datos base)

Las semillas cargan catálogos, roles y permisos. Sin ellas, los servicios de reservas, solicitudes, eventos y PQRS fallan al crear registros, porque buscan un estado inicial (por ejemplo `pending`).

### 5.1 Orden de ejecución (obligatorio)

| Orden | Archivo | Base | Motivo del orden |
| --- | --- | --- | --- |
| 1 | `ms-catalog_001_seed.sql` | `uajs_catalog` | Debe ir primero: `ms-academic` consulta `uajs_catalog.cities`. |
| 2 | `ms-auth_001_seed.sql` | `uajs_auth` | Roles y permisos base. No tiene dependencias. |
| 3 | `ms-academic_001_seed.sql` | `uajs_academic` | Sede principal, facultades y programas. Depende de `uajs_catalog`. |
| 4 | `ms-resources_001_seed.sql` | `uajs_resources` | Categorías y estados de recursos. |
| 5 | `ms-bookings_001_seed.sql` | `uajs_bookings` | Tipos y estados de reserva. |
| 6 | `ms-requests_001_seed.sql` | `uajs_requests` | Categorías, tipos y estados de solicitud. |
| 7 | `ms-events_001_seed.sql` | `uajs_events` | Categorías y estados de evento. |
| 8 | `ms-pqrs_001_seed.sql` | `uajs_pqrs` | Tipos y estados de PQRS. |

No existen semillas para `uajs_notifications` ni `uajs_storage`. Esas bases quedan vacías, y es lo esperado.

Todas las semillas son idempotentes (`INSERT ... ON DUPLICATE KEY UPDATE` e `INSERT IGNORE`), así que se pueden volver a ejecutar sin duplicar datos.

### 5.2 Comandos

**Bash (Git Bash o WSL):**

```bash
for s in ms-catalog ms-auth ms-academic ms-resources ms-bookings ms-requests ms-events ms-pqrs; do
  echo "Sembrando $s"
  docker exec -i uajs-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4' < "scripts/seed/${s}_001_seed.sql"
done
```

**PowerShell:** reemplaza `uajs206**` por el valor de `MYSQL_ROOT_PASSWORD` si lo cambiaste.

```powershell
$OutputEncoding = [System.Text.Encoding]::UTF8
$seeds = 'ms-catalog','ms-auth','ms-academic','ms-resources','ms-bookings','ms-requests','ms-events','ms-pqrs'
foreach ($s in $seeds) {
  Write-Host "Sembrando $s"
  Get-Content -Raw -Encoding utf8 "scripts\seed\${s}_001_seed.sql" | docker exec -i uajs-mysql mysql -uroot -puajs206** --default-character-set=utf8mb4
}
```

> **Nota:** los comentarios de algunos archivos de semilla muestran `-proot` como ejemplo. Esa contraseña no coincide con la configuración por defecto de Docker. Usa siempre la contraseña de `MYSQL_ROOT_PASSWORD`.

**Resultado esperado:** los ocho comandos terminan sin `ERROR`.

---

## 6. Verificación

### 6.1 Estado de los contenedores

```
docker compose -f infrastructure/docker/docker-compose.yml ps
```

| Contenedor | Estado esperado |
| --- | --- |
| `uajs-mysql` | `Up ... (healthy)` |
| `uajs-redis` | `Up ... (healthy)` |

Redis:

```
docker exec uajs-redis redis-cli ping
```

**Resultado esperado:** `PONG`

### 6.2 Abrir la consola de MySQL

```
docker exec -it uajs-mysql mysql -uroot -p
```

Escribe la contraseña de `MYSQL_ROOT_PASSWORD` cuando se pida. Las consultas siguientes se pegan en esa consola.

### 6.3 Bases de datos creadas

```sql
SHOW DATABASES LIKE 'uajs\_%';
```

**Resultado esperado: 11 filas.** Son las 10 bases de microservicio más `uajs_smart_campus`, que crea Compose por defecto:

| Base de datos |
| --- |
| uajs_academic |
| uajs_auth |
| uajs_bookings |
| uajs_catalog |
| uajs_events |
| uajs_notifications |
| uajs_pqrs |
| uajs_requests |
| uajs_resources |
| uajs_smart_campus |
| uajs_storage |

### 6.4 Tablas por base de datos

```sql
SELECT TABLE_SCHEMA AS base_de_datos, COUNT(*) AS tablas
FROM information_schema.TABLES
WHERE TABLE_SCHEMA LIKE 'uajs\_%' AND TABLE_TYPE = 'BASE TABLE'
GROUP BY TABLE_SCHEMA
ORDER BY TABLE_SCHEMA;
```

**Resultado esperado: 10 filas y un total de 54 tablas.**

| Base de datos | Tablas |
| --- | --- |
| uajs_academic | 7 |
| uajs_auth | 11 |
| uajs_bookings | 4 |
| uajs_catalog | 4 |
| uajs_events | 4 |
| uajs_notifications | 4 |
| uajs_pqrs | 6 |
| uajs_requests | 7 |
| uajs_resources | 6 |
| uajs_storage | 1 |

### 6.5 Conteo de filas de las semillas

```sql
SELECT 'catalog.countries' AS tabla, COUNT(*) AS filas FROM uajs_catalog.countries
UNION ALL SELECT 'catalog.departments', COUNT(*) FROM uajs_catalog.departments
UNION ALL SELECT 'catalog.cities', COUNT(*) FROM uajs_catalog.cities
UNION ALL SELECT 'catalog.document_types', COUNT(*) FROM uajs_catalog.document_types
UNION ALL SELECT 'academic.campuses', COUNT(*) FROM uajs_academic.campuses
UNION ALL SELECT 'academic.faculties', COUNT(*) FROM uajs_academic.faculties
UNION ALL SELECT 'academic.programs', COUNT(*) FROM uajs_academic.programs
UNION ALL SELECT 'auth.roles', COUNT(*) FROM uajs_auth.roles
UNION ALL SELECT 'auth.permissions', COUNT(*) FROM uajs_auth.permissions
UNION ALL SELECT 'auth.role_permissions', COUNT(*) FROM uajs_auth.role_permissions
UNION ALL SELECT 'auth.users', COUNT(*) FROM uajs_auth.users
UNION ALL SELECT 'resources.resource_categories', COUNT(*) FROM uajs_resources.resource_categories
UNION ALL SELECT 'resources.resource_statuses', COUNT(*) FROM uajs_resources.resource_statuses
UNION ALL SELECT 'bookings.booking_types', COUNT(*) FROM uajs_bookings.booking_types
UNION ALL SELECT 'bookings.booking_statuses', COUNT(*) FROM uajs_bookings.booking_statuses
UNION ALL SELECT 'requests.request_categories', COUNT(*) FROM uajs_requests.request_categories
UNION ALL SELECT 'requests.request_types', COUNT(*) FROM uajs_requests.request_types
UNION ALL SELECT 'requests.request_statuses', COUNT(*) FROM uajs_requests.request_statuses
UNION ALL SELECT 'events.event_categories', COUNT(*) FROM uajs_events.event_categories
UNION ALL SELECT 'events.event_statuses', COUNT(*) FROM uajs_events.event_statuses
UNION ALL SELECT 'pqrs.pqrs_types', COUNT(*) FROM uajs_pqrs.pqrs_types
UNION ALL SELECT 'pqrs.pqrs_statuses', COUNT(*) FROM uajs_pqrs.pqrs_statuses;
```

**Resultado esperado:**

| Tabla | Filas |
| --- | --- |
| catalog.countries | 1 |
| catalog.departments | 33 |
| catalog.cities | 136 |
| catalog.document_types | 6 |
| academic.campuses | 1 |
| academic.faculties | 3 |
| academic.programs | 4 |
| auth.roles | 5 |
| auth.permissions | 22 |
| auth.role_permissions | 22 |
| auth.users | 0 |
| resources.resource_categories | 5 |
| resources.resource_statuses | 4 |
| bookings.booking_types | 4 |
| bookings.booking_statuses | 6 |
| requests.request_categories | 4 |
| requests.request_types | 6 |
| requests.request_statuses | 5 |
| events.event_categories | 5 |
| events.event_statuses | 5 |
| pqrs.pqrs_types | 5 |
| pqrs.pqrs_statuses | 4 |

`auth.users` debe ser 0: el seed de autenticación no crea usuarios. La primera cuenta se registra con datos reales a través de `auth-service`.

### 6.6 Integridad entre bases (sede → ciudad)

`uajs_academic.campuses` guarda el `city_uuid` de una ciudad de `uajs_catalog`. Si las semillas se ejecutaron en orden incorrecto, la sede recibe un UUID aleatorio sin error visible. Esta consulta lo detecta:

```sql
SELECT COUNT(*) AS campus_sin_ciudad
FROM uajs_academic.campuses c
WHERE NOT EXISTS (SELECT 1 FROM uajs_catalog.cities ci WHERE ci.uuid = c.city_uuid);
```

**Resultado esperado: 0.** Si da 1 o más, vuelve a ejecutar la semilla `ms-catalog` y luego `ms-academic`.

### 6.7 Permisos del usuario de la aplicación

```sql
SHOW GRANTS FOR 'uajs_user'@'%';
```

**Resultado esperado:** aparecen permisos sobre cada base `uajs_*` (incluidas `uajs_auth`, `uajs_academic`, `uajs_bookings`, etc.).

### 6.8 Prueba de conexión con el usuario de la aplicación

Desde la consola de MySQL, o desde un cliente en el host (`127.0.0.1`, puerto `3307`, usuario `uajs_user`):

```sql
SELECT COUNT(*) AS roles FROM uajs_auth.roles;
```

**Resultado esperado:** `roles = 5`. Esto confirma que el usuario de la aplicación puede leer la base de autenticación.

### 6.9 Lista de verificación final

| # | Verificación | Resultado esperado | Hecho |
| --- | --- | --- | --- |
| 1 | `npm install` termina sin errores | Sin errores | ☐ |
| 2 | `npm run validate:env` | "Todos los archivos de entorno son validos" | ☐ |
| 3 | `uajs-mysql` y `uajs-redis` en estado `healthy` | Ambos healthy | ☐ |
| 4 | `redis-cli ping` | `PONG` | ☐ |
| 5 | `SHOW DATABASES LIKE 'uajs\_%'` (6.3) | 11 filas | ☐ |
| 6 | Conteo de tablas (6.4) | 54 tablas en 10 bases | ☐ |
| 7 | Conteo de semillas (6.5) | Valores de la tabla de 6.5 | ☐ |
| 8 | Integridad sede → ciudad (6.6) | 0 | ☐ |
| 9 | Permisos de `uajs_user` (6.7) | Permisos sobre `uajs_*` | ☐ |
| 10 | Conexión con `uajs_user` (6.8) | `roles = 5` | ☐ |

---

## 7. Evidencias a capturar

Para documentar la inicialización, captura en este orden:

1. Este archivo abierto en VS Code (vista previa de Markdown) mostrando la sección que corresponda.
2. Salida de `docker compose ... ps` con `healthy` en MySQL y Redis.
3. Salida de `docker logs uajs-mysql` con las diez migraciones aplicadas (sección 4.1).
4. Resultado de `SHOW DATABASES LIKE 'uajs\_%'` (6.3) y del conteo de tablas (6.4).
5. Resultado del conteo de semillas (6.5).

---

## 8. Levantar los microservicios (opcional)

Con la base lista, puedes levantar todos los servicios:

```
npm run docker:up
```

Para ver los logs:

```
npm run docker:logs
```

Para Elasticsearch (opcional, no es necesario para la base de datos):

```
docker compose -f infrastructure/docker/docker-compose.yml up -d elasticsearch
npm run es:status
npm run es:setup
```

---

## 9. Solución de problemas

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `uajs-mysql` no pasa a `healthy` | El servidor tarda en iniciar, o el puerto `3307` está ocupado. | Espera 60 s. Revisa `docker logs uajs-mysql`. Si el puerto está ocupado, cambia el mapeo `3307:3306` en el compose. |
| No hay logs de migraciones en `docker logs` | El volumen `mysql_data` ya existía, así que `init` no se ejecutó. | Aplica la sección 4.2. |
| `ERROR 1045 (28000): Access denied` | La contraseña no coincide. Si el volumen se creó con otra contraseña, cambiar `.env` no la actualiza. | Usa la contraseña con la que se creó el volumen, o reinicia el volumen (ver abajo). |
| `Unknown database 'uajs_catalog'` al sembrar `ms-academic` | No se aplicaron las migraciones. | Aplica la sección 4.2 y vuelve a sembrar. |
| La consulta 6.6 devuelve 1 o más | Las semillas se ejecutaron fuera de orden. | Ejecuta de nuevo `ms-catalog` y después `ms-academic`. |
| `npm run validate:env` falla con `SERVICE_AUTH_TOKEN` | El token tiene menos de 32 caracteres. | Ajusta el valor en `.env` o en la plantilla. |
| Un servicio dentro de Docker no conecta a MySQL | Dentro de la red de Docker el host es `mysql` y el puerto `3306`, no `127.0.0.1:3307`. | Usa `MYSQL_HOST=mysql` y `MYSQL_PORT=3306` (ya están configurados en el compose). |

### Reiniciar la base de datos desde cero

Esta acción **borra todos los datos** de los volúmenes del proyecto (`mysql_data`, `redis_data`, `storage_uploads` y `es-data`):

```
docker compose -f infrastructure/docker/docker-compose.yml down -v
docker compose -f infrastructure/docker/docker-compose.yml up -d mysql redis
```

Después vuelve a ejecutar las secciones 4 a 6.

---

## 10. Referencias del repositorio

| Archivo | Rol en la inicialización |
| --- | --- |
| `infrastructure/docker/docker-compose.yml` | Define MySQL, Redis y los servicios. Monta `init/` y `scripts/migrations/`. |
| `infrastructure/docker/init/init-databases.sh` | Aplica las migraciones y concede permisos en el primer arranque. |
| `scripts/migrations/ms-*_001_init.sql` | Esquemas de cada base de datos. |
| `scripts/seed/ms-*_001_seed.sql` | Datos base de cada base de datos. |
| `scripts/validate-env.js` | Valida las plantillas de entorno (`npm run validate:env`). |
| `.env.example` | Plantilla de variables del proyecto. |
| `scripts/migrations/uajs-db-README.md` | Mapa de bases y tablas (ver nota abajo). |

> **Nota de corrección:** la sección "Apply all schemas" de `scripts/migrations/uajs-db-README.md` no es válida para este repositorio. Usa el puerto `3306` (en Docker el host es `3307`), referencias `./<servicio>/001_init.sql` que no existen, y omite `uajs_pqrs` y `uajs_storage`. Para aplicar las migraciones, usa la sección 4 de esta guía.

### Referencias que ya no existen

Algunos documentos del repositorio mencionan piezas que no están en el código. No las uses:

| Mención | Estado |
| --- | --- |
| `scripts/migrations/migrate.js` (`infrastructure/docker/README.md`) | No existe en el repositorio. Usa la sección 4. |
| `infrastructure/docker/init/01-schema.sql` (`infrastructure/docker/README.md`) | No existe. El script real es `init-databases.sh`. |
| Base `uajs_smart_campus_test` | Ningún script la crea. |
| "Al menos 36 tablas" (`infrastructure/docker/README.md`) | Las migraciones definen 54 tablas. |
