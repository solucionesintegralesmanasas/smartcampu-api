# university-service

Estructura académica de UAJS Smart Campus: sedes, empresas (convenios),
terceros (personas), facultades, programas, estudiantes y docentes.

## Base de datos propia

A diferencia de `user-service`, este servicio **sí tiene su propia base**
(`uajs_academic`, migración `scripts/migrations/ms-academic_001_init.sql`).
Su tabla `persons` ("tercero") es un registro maestro **independiente** del
`persons` de `auth-service`: uno es la identidad académica/institucional
(con fecha de nacimiento, género, dirección), el otro es la identidad de
login. Se enlazan de forma débil: `students.user_uuid` / `teachers.user_uuid`
guardan el `uuid` del usuario en `auth-service` (sin FK entre bases).

## Cadena de dependencias

```
sede (campuses) -> facultad (faculties) -> programa (programs) -> estudiante (students)
                                        \-> docente (teachers)
tercero (persons) -> estudiante / docente
```

Borrar un nivel está bloqueado mientras tenga hijos activos (sede con
facultades activas, facultad con programas o docentes activos, programa con
estudiantes activos, tercero vinculado a un estudiante/docente activo).

## Endpoints internos (`by-user/:userUuid`)

`GET /api/v1/university/estudiantes/by-user/:userUuid` y el equivalente de
`docentes` no requieren un usuario final autenticado: los llama
`user-service` (perfil polimórfico) con el `X-Service-Token` compartido, sin
identidad de usuario adjunta. Se protegen con `requireTrustedService`, no con
`requireAuth`, y **deben registrarse antes de `/:id`** en las rutas (si no,
`/:id` capturaría `by-user` como valor del id).

## Variables de entorno

Ver `.env.example`. `SERVICE_AUTH_TOKEN` debe coincidir con el del
api-gateway y el resto de servicios.
