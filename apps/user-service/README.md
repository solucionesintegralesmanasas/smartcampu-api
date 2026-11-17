# user-service

Administración de usuarios, roles y permisos (RBAC), y perfil polimórfico.

## Decisión de arquitectura: base de datos compartida con auth-service

Este servicio **no tiene su propia base de datos**. Se conecta a la misma
base (`uajs_auth`) que usa `auth-service`, porque las tablas `users`,
`persons`, `roles`, `permissions`, `role_permissions` y `user_roles` ya
existen ahí y son la fuente de verdad para el login/JWT. Duplicarlas en una
base `uajs_users` separada crearía dos fuentes de verdad para roles que
podrían desincronizarse.

**Propietario de cada dato:**

- `auth-service`: credenciales (`password_hash`), emisión/verificación de
  JWT, refresh tokens, reseteo de contraseña. **No lo dupliques aquí.**
- `user-service`: administración de usuarios (activar/desactivar, editar
  perfil básico), CRUD de roles y permisos (incluida la asignación
  rol↔permiso), y el endpoint de perfil polimórfico.

Si renombras un rol de sistema (`SUPERADMIN`, `ADMIN`, `STAFF`, `TEACHER`,
`STUDENT`) se rompe el orden de precedencia hardcodeado en
`auth-service/src/modules/auth/auth.repository.js` (`FIELD(r.name, ...)`),
por eso `rol.service.js` bloquea el renombrado de roles con `is_system = 1`.

## Perfil polimórfico

`GET /api/v1/users/perfil` enriquece el perfil básico con datos de
estudiante/docente llamando a `university-service` (Fase 2 del plan, aún no
implementado). Mientras ese servicio no exista o no responda, el perfil
degrada a `{ tipo: 'basico' }` en vez de fallar.

## Seguridad entre servicios

Los headers `X-User-Id`/`X-User-Roles` que inyecta el api-gateway solo se
confían si la petición también trae `X-Service-Token` con el mismo valor de
`SERVICE_AUTH_TOKEN` configurado aquí (ver
`src/core/middleware/identity.middleware.js`). Sin este chequeo, cualquiera
que le hablara directo al puerto interno del servicio podría forjar
`X-User-Id` y suplantar a otro usuario.

## Variables de entorno

Ver `.env.example`. `SERVICE_AUTH_TOKEN` debe coincidir con el del
api-gateway y el resto de servicios.
