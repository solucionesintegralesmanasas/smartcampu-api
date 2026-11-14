# user-service

Servicio de **perfiles y preferencias** de usuarios (puerto `3002`, prefijo `/api/v1/usuarios`, base `uajs_users`).

> La identidad (cuenta, roles y contraseñas) vive en `auth-service` (`uajs_auth`) y **no se duplica** aquí. Los registros se indexan por `user_id`, que es el claim `sub` del JWT.

## Endpoints

| Método   | Ruta                              | Roles               | Descripción                                    |
| -------- | --------------------------------- | ------------------- | ---------------------------------------------- |
| GET      | `/api/v1/usuarios/me`             | Cualquier autenticado | Perfil del usuario del token (404 si no existe) |
| PUT      | `/api/v1/usuarios/me`             | Cualquier autenticado | Crear o actualizar el perfil (upsert)          |
| GET      | `/api/v1/usuarios/me/preferencias` | Cualquier autenticado | Preferencias (valores por defecto si no existen) |
| PUT      | `/api/v1/usuarios/me/preferencias` | Cualquier autenticado | Crear o actualizar preferencias (upsert)       |
| GET      | `/api/v1/usuarios`                | ADMIN, STAFF        | Listado paginado (`page`, `limit` ≤ 100, `search`) |
| GET      | `/api/v1/usuarios/:userId`        | ADMIN, STAFF        | Perfil de otro usuario                         |
| DELETE   | `/api/v1/usuarios/:userId`        | ADMIN               | Borrado lógico del perfil                      |

Documentación interactiva: `/api/docs`. Salud: `GET /healthz`.

## Autenticación

Bearer JWT firmado con `JWT_SECRET` (el mismo de auth-service). Se usa `sub` como id de usuario y `rol` (rol de mayor jerarquía) para la autorización.

## Eventos

No se publican ni consumen eventos: `packages/shared-types/src/event.types.js` no define aún un evento de perfil de usuario.

## Variables de entorno

Ver `.env.example`. Las principales: `PORT`, `JWT_SECRET`, `MYSQL_*` (base `uajs_users`), `REDIS_*`, `ELASTICSEARCH_*`, `USER_INDEX`.

## Base de datos

Migración: `scripts/migrations/ms-users_001_init.sql` (tablas `user_profiles` y `user_preferences`), aplicada con `npm run db:migrate` desde la raíz.

## Pruebas

```bash
cd apps/user-service && npm run test:unit
```
