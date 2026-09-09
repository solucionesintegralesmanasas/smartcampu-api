# scripts/legacy — Material histórico (obsoleto)

> [!IMPORTANT]
> Esta carpeta **NO se usa** en tiempo de ejecución, Docker, pruebas ni migraciones.
> No debe contener los scripts `ms-*_001_init.sql` ni schemas activos.

## Propósito

`scripts/legacy/` es un área de respaldo para **material histórico y obsoleto** que se
conserva solo como referencia. Nada de lo que vive aquí se ejecuta ni se monta.

## ¿Dónde está lo que sí se usa?

La arquitectura actual es **database-per-microservice** (una base de datos por servicio):

| Ubicación                                      | Rol                                                                                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/migrations/ms-*_001_init.sql`         | Migraciones SQL canónicas por servicio (`uajs_catalog`, `uajs_auth`, …). Cada script crea su propia base con `CREATE DATABASE IF NOT EXISTS` + `USE`. |
| `scripts/migrations/uajs-db-README.md`         | Documentación oficial y mapa de bases por microservicio.                                                                                              |
| `infrastructure/docker/init/init-databases.sh` | Inicializa las bases en el primer arranque de MySQL (Docker) ejecutando las migraciones.                                                              |
| `scripts/migrations/migrate.js`                | Runner de migraciones (opcional, documentado en `infrastructure/docker/README.md`).                                                                   |

## Qué NO se debe poner aquí

- Los scripts `ms-*_001_init.sql` activos → viven en `scripts/migrations/`.
- Esquemas o step que los servicios consuman en producción.

El antiguo esquema monolítico (`01-schema-monolith.sql`) es ahora obsoleto: la arquitectura
por microservicio lo reemplazó por completo.
