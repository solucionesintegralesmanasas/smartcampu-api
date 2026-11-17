# Evidencia 1 — Plan y matriz de pruebas

**Proyecto:** UAJS Smart Campus — API (microservicios)
**Versión del documento:** 1.0
**Fecha de creación:** 2026-10-24
**Responsable de QA:** [Nombre]
**Estado general del plan:** Diseñado — pendiente de ejecución

> **Nota de uso:** las columnas *Resultado obtenido* y *Estado* se completan durante la ejecución. Mientras un caso no se haya ejecutado, figura como **Pendiente**. No modificar los resultados esperados sin registrar un cambio en el control de versiones del documento.

---

## 1. Objetivo

Definir la estrategia, el alcance y los casos de prueba que verificarán el funcionamiento de la plataforma Smart Campus, y servir como registro de seguimiento de su ejecución.

## 2. Alcance

### 2.1 Incluido

| Componente | Puerto | Pruebas previstas |
| --- | --- | --- |
| Infraestructura (MySQL, Redis, Elasticsearch) | 3307 / 6379 / 9200 | Disponibilidad, bases, semillas, integridad |
| api-gateway | 3000 | Autenticación JWT, rutas, reescritura de prefijos, rate limit, errores |
| auth-service | 3001 | Registro, inicio de sesión, emisión de tokens, errores |
| university-service | 3004 | Consulta de sedes (ruta protegida) |
| catalog-service | 3003 | Limitación documentada (`/catalogos/campuses`) |
| booking-service (reservas) | 3006 | Creación de reservas, conflictos, dependencia de semillas |
| event-service (eventos) | 3008 | Inscripciones, duplicados, fecha límite, cancelación, check-in |
| request-service (solicitudes) | 3007 | Creación de solicitudes |
| pqrs-service | 3010 | Radicación anónima y consulta |
| notification-service | 3009 | Notificaciones asíncronas por eventos de dominio |
| storage-service | 3011 | Carga de archivos |
| Transversal | — | Autorización por rol, tolerancia a fallos (Elasticsearch / Redis), calidad (lint y pruebas unitarias) |

### 2.2 Excluido

- Pruebas de carga y rendimiento masivo (se planificarán en una evidencia posterior).
- Pruebas de seguridad de penetración.
- Interfaz de usuario: el sistema es una API REST; no hay frontend en este alcance.
- Módulos de servicios en estado *scaffold* (directorios sin código real), verificados en `AGENTS.md`.
- Pruebas de despliegue en Kubernetes.

## 3. Estrategia de pruebas

| Nivel | Descripción | Herramienta / medio | Ejecutor |
| --- | --- | --- | --- |
| Infraestructura | Verificación de contenedores, bases y semillas | `docker compose ps`, consola MySQL | QA |
| Unitario | Lógica de servicios, middlewares y consumidores | Jest (`npm run test:unit`) | Desarrollo / QA |
| Integración / E2E | Flujos completos por el gateway y entre servicios | Colección REST Client (`tests/http/*.http`), `npm run test:e2e` | QA |
| Resiliencia | Comportamiento ante caída de Elasticsearch o Redis | Detener el contenedor y medir tiempos de respuesta | QA |
| Calidad estática | Estilo y formato | `npm run lint`, `npm run format:check` | Desarrollo |

### 3.1 Tipos de prueba

- **Funcional positiva:** el flujo se completa con datos válidos.
- **Funcional negativa:** los datos o permisos inválidos se rechazan con el código HTTP correcto.
- **Frontera / reglas de negocio:** fecha límite, cupos, conflictos de horario.
- **Seguridad básica:** ausencia de token, firma inválida, rol insuficiente, token entre servicios.
- **Resiliencia:** la falla de una dependencia no debe colgar la petición HTTP.

## 4. Criterios

### 4.1 Criterios de entrada

- Dependencias instaladas (`npm install`) sin errores.
- `npm run validate:env` aprobado.
- Infraestructura en estado `healthy`.
- Semillas aplicadas en el orden documentado en `docs/guia-inicializacion.md`.
- Los 12 servicios responden a su health check.

### 4.2 Criterios de salida

- 100 % de los casos de prioridad **Alta** ejecutados y aprobados.
- Al menos el 90 % de los casos totales aprobados.
- Sin defectos abiertos de severidad **Crítica** o **Alta**.
- Los defectos de severidad Media o Baja están documentados con plan de corrección.

### 4.3 Criterios de suspensión

- Caída de MySQL o del gateway durante la ejecución.
- Más del 30 % de los casos bloqueados por el mismo defecto de entorno.

## 5. Ambiente de pruebas

| Elemento | Configuración |
| --- | --- |
| Sistema operativo | Windows 10/11 con Git Bash |
| Node.js | 20.x |
| Docker | Engine 20.10+ / Compose v2 |
| Base de datos | MySQL 8 en `127.0.0.1:3307` |
| Caché / colas | Redis 7 en `localhost:6379` |
| Búsqueda | Elasticsearch 8.12 en `localhost:9200` |
| Punto de entrada | `http://localhost:3000` (gateway) |
| Datos de prueba | Usuario `prueba@uajs.edu`, documento `1020304050` |

## 6. Roles y responsabilidades

| Rol | Responsable | Función |
| --- | --- | --- |
| Líder de QA | [Nombre] | Aprueba el plan, consolida resultados y estados |
| Ejecutor de pruebas | [Nombre] | Ejecuta casos y registra resultados obtenidos |
| Desarrollador | [Nombre] | Corrige defectos y valida correcciones |
| Administrador de infraestructura | [Nombre] | Mantiene Docker, semillas y entornos |

## 7. Prioridad y severidad

**Prioridad del caso:**

- **Alta:** flujo crítico (autenticación, reservas, inscripciones, seguridad).
- **Media:** flujo secundario o validación de datos.
- **Baja:** casos de conveniencia o verificación documental.

**Severidad del defecto:**

- **Crítica:** el sistema no funciona o hay exposición de datos.
- **Alta:** un flujo principal falla sin alternativa.
- **Media:** un flujo falla con alternativa disponible.
- **Baja:** problema cosmético o de documentación.

## 8. Estados

| Estado | Significado |
| --- | --- |
| **Pendiente** | Caso diseñado, no ejecutado |
| **En ejecución** | Caso en curso |
| **Aprobado** | Resultado obtenido coincide con el esperado |
| **Fallido** | Resultado obtenido difiere del esperado; se registra defecto |
| **Bloqueado** | No puede ejecutarse por una dependencia externa |
| **Conocido** | Comportamiento documentado como limitación; no cuenta como fallo nuevo |

---

## 9. Matriz de casos de prueba

### 9.1 Infraestructura y datos

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-INF-01 | Infraestructura | Funcional | Ejecutar `docker compose -f infrastructure/docker/docker-compose.yml ps` | MySQL, Redis y Elasticsearch en estado `(healthy)` | Pendiente | Pendiente |
| CP-INF-02 | MySQL | Funcional | Ejecutar `SHOW DATABASES LIKE 'uajs\_%';` | 11 filas (10 bases + `uajs_smart_campus`) | Pendiente | Pendiente |
| CP-INF-03 | MySQL | Funcional | Ejecutar `SELECT COUNT(*) FROM uajs_auth.roles;` | Resultado `5` | Pendiente | Pendiente |
| CP-INF-04 | MySQL | Funcional | Ejecutar `SELECT COUNT(*) FROM uajs_catalog.cities;` | Resultado `136` | Pendiente | Pendiente |
| CP-INF-05 | MySQL | Integridad | Ejecutar la consulta `campus_sin_ciudad` de la guía | Resultado `0` | Pendiente | Pendiente |
| CP-INF-06 | Servicios | Funcional | Consultar los 12 health checks listados en el README (sección 4.2) | Todos responden `200` | Pendiente | Pendiente |
| CP-INF-07 | Gateway | Funcional | Con un servicio interno detenido, consultar `/health/readiness` | Responde `503` | Pendiente | Pendiente |

### 9.2 Autenticación

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-AUT-01 | auth-service | Funcional positiva | `POST /api/v1/auth/register` por el gateway con datos válidos y email nuevo | `201`, `success: true`, `data` con `id` y `uuid` | Pendiente | Pendiente |
| CP-AUT-02 | auth-service | Negativa | Registrar un email que ya existe | `409` (`ConflictError`) | Pendiente | Pendiente |
| CP-AUT-03 | auth-service | Negativa | Registrar con cuerpo incompleto (sin `email` ni `password`) | `400` con detalle de validación Zod | Pendiente | Pendiente |
| CP-AUT-04 | auth-service | Funcional positiva | `POST /api/v1/auth/login` con credenciales válidas | `200` con `data.accessToken` y `data.refreshToken` | Pendiente | Pendiente |
| CP-AUT-05 | auth-service | Negativa | Login con contraseña incorrecta | `401` (`UnauthorizedError`) | Pendiente | Pendiente |
| CP-AUT-06 | auth-service | Seguridad | Decodificar el `accessToken` del CP-AUT-04 | El payload contiene `roles` como **arreglo** y `rol` como cadena | Pendiente | Pendiente |

### 9.3 Gateway

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-GW-01 | api-gateway | Seguridad | `GET /api/v1/universidad/sedes` sin cabecera `Authorization` | `401` | Pendiente | Pendiente |
| CP-GW-02 | api-gateway | Seguridad | Enviar un JWT firmado con otro secreto | `401` con mensaje de firma inválida | Pendiente | Pendiente |
| CP-GW-03 | api-gateway | Funcional negativa | `GET /api/v1/ruta-inexistente` con token válido | `404` | Pendiente | Pendiente |
| CP-GW-04 | api-gateway | Funcional | `GET /api/v1/universidad/sedes` con token válido | `200` con datos de sedes; la ruta se reescribe a `/api/v1/university/...` | Pendiente | Pendiente |
| CP-GW-05 | api-gateway | Funcional | `POST /api/v1/auth/register` a través del gateway con cuerpo JSON | `201`; el cuerpo llega completo (sin `ECONNRESET` ni espera infinita) | Pendiente | Pendiente |
| CP-GW-06 | api-gateway | Negativa | Superar el límite del token bucket con peticiones repetidas | `429` con cabecera `Retry-After` | Pendiente | Pendiente |
| CP-GW-07 | Servicios internos | Seguridad | Llamar directamente a un servicio interno (p. ej. `:3004`) sin `X-Service-Token` | Rechazo (`401` o `403`) | Pendiente | Pendiente |

### 9.4 Autorización por rol

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-AUZ-01 | user-service | Seguridad | Usuario con rol `STUDENT` consulta `GET /api/v1/usuarios/usuarios/1` | `403` (`ForbiddenError`) | Pendiente | Pendiente |
| CP-AUZ-02 | user-service | Funcional | Asignar rol `SUPERADMIN` (SQL del README 4.3), volver a iniciar sesión y consultar la misma ruta | `200` con datos del usuario | Pendiente | Pendiente |

### 9.5 Catálogos y académico

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-UNI-01 | university-service | Funcional | Con token válido, `GET /api/v1/universidad/sedes` | `200` con al menos 1 sede (semilla) | Pendiente | Pendiente |
| CP-CAT-01 | catalog-service | Funcional | `GET /api/v1/catalogos/campuses` | Esperado `200`. Limitación documentada: responde `500` por tabla `uajs_catalog.sedes` inexistente | Pendiente | **Conocido** |

### 9.6 Reservas (booking-service)

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-RES-01 | booking-service | Funcional positiva | Con token válido, crear reserva sobre un recurso disponible en franja libre | `201`; la reserva queda con estado inicial `pending` | Pendiente | Pendiente |
| CP-RES-02 | booking-service | Regla de negocio | Crear una reserva en una franja ya ocupada por otra | `409` (`ConflictError`) | Pendiente | Pendiente |
| CP-RES-03 | booking-service | Negativa | Crear reserva sobre un recurso inexistente | `404` | Pendiente | Pendiente |
| CP-RES-04 | booking-service | Dependencia | Ejecutar CP-RES-01 en un entorno sin la semilla de estado `pending` | `404` (estado inicial no encontrado) | Pendiente | Pendiente |

### 9.7 Eventos (event-service)

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-EVT-01 | event-service | Funcional positiva | Inscribirse en un evento publicado, con inscripción abierta y cupo disponible | Inscripción creada (confirmada o en lista de espera según cupo) | Pendiente | Pendiente |
| CP-EVT-02 | event-service | Regla de negocio | Inscribirse por segunda vez en el mismo evento | `409` (ya inscrito y activo) | Pendiente | Pendiente |
| CP-EVT-03 | event-service | Frontera | Inscribirse después de la fecha límite | `409` | Pendiente | Pendiente |
| CP-EVT-04 | event-service | Regla de negocio | Cancelar una inscripción que ya está cancelada | `409` | Pendiente | Pendiente |
| CP-EVT-05 | event-service | Seguridad | Un estudiante invoca el check-in de una inscripción | `403` (`ForbiddenError`) | Pendiente | Pendiente |

### 9.8 Solicitudes y PQRS

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-SOL-01 | request-service | Funcional | Crear una solicitud con tipo y categoría válidos | `201` con estado inicial de la semilla (`draft` o `pending`) | Pendiente | Pendiente |
| CP-PQR-01 | pqrs-service | Funcional | Radicar una PQRS de forma anónima | `201` con número de radicado | Pendiente | Pendiente |
| CP-PQR-02 | pqrs-service | Funcional | Consultar la PQRS con el radicado obtenido en CP-PQR-01 | `200` con estado y datos de la PQRS | Pendiente | Pendiente |

### 9.9 Notificaciones y almacenamiento

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-NOT-01 | notification-service | Asíncrona | Tras CP-RES-01, revisar `uajs_notifications.notifications` y `docker logs` | Registro de notificación presente dentro de 10 s | Pendiente | Pendiente |
| CP-NOT-02 | booking-service | Resiliencia | Detener Redis y crear una reserva | Respuesta HTTP en tiempo acotado (≈ 2 s de timeout del productor); no se cuelga | Pendiente | Pendiente |
| CP-STO-01 | storage-service | Funcional | Subir un archivo de tipo permitido | `201` con identificador del archivo | Pendiente | Pendiente |
| CP-STO-02 | storage-service | Negativa | Subir un archivo de tipo no permitido o sin archivo | `400` | Pendiente | Pendiente |

### 9.10 Resiliencia y calidad

| ID | Servicio | Tipo | Precondiciones y pasos | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CP-ES-01 | Transversal | Resiliencia | Detener Elasticsearch y ejecutar `POST /api/v1/auth/login` | Respuesta en ≈ 2 s (circuit breaker); no supera 3 s | Pendiente | Pendiente |
| CP-CAL-01 | Transversal | Calidad | Ejecutar `npm run lint` en la raíz | Sin errores | Pendiente | Pendiente |
| CP-CAL-02 | Transversal | Calidad | Ejecutar `npm test` en la raíz | Todas las pruebas unitarias y E2E pasan | Pendiente | Pendiente |

---

## 10. Resumen de cobertura

| Módulo | Casos |
| --- | --- |
| Infraestructura y datos (9.1) | 7 |
| Autenticación (9.2) | 6 |
| Gateway (9.3) | 7 |
| Autorización por rol (9.4) | 2 |
| Catálogos y académico (9.5) | 2 |
| Reservas (9.6) | 4 |
| Eventos (9.7) | 5 |
| Solicitudes y PQRS (9.8) | 3 |
| Notificaciones y almacenamiento (9.9) | 4 |
| Resiliencia y calidad (9.10) | 3 |
| **Total** | **43** |

## 11. Seguimiento de ejecución

| Estado | Cantidad |
| --- | --- |
| Pendiente | 42 |
| En ejecución | 0 |
| Aprobado | 0 |
| Fallido | 0 |
| Bloqueado | 0 |
| Conocido | 1 |

> Actualizar esta tabla al cierre de cada jornada de ejecución.

## 12. Registro de defectos

| ID defecto | Caso | Severidad | Descripción | Responsable | Estado |
| --- | --- | --- | --- | --- | --- |
| — | — | — | Sin defectos registrados aún | — | — |

## 13. Riesgos del plan

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Semillas incompletas o aplicadas en orden incorrecto | Casos de reservas, eventos, solicitudes y PQRS bloqueados | Verificar conteos en CP-INF-02 a CP-INF-05 antes de ejecutar |
| Elasticsearch con poca RAM en Docker Desktop | Tiempos de arranque altos y falsos fallos de búsqueda | Asignar ~2 GB libres; confirmar con `npm run es:status` |
| Desfase entre el JWT del gateway y el de auth-service | Todas las rutas protegidas responden `401 invalid signature` | Verificar `JWT_SECRET` en ambos `.env` antes de iniciar |
| Usuario de prueba indexado tarde en Elasticsearch | Búsquedas de usuarios no encuentran el registro | Esperar la indexación o usar consulta por ID |
| Pruebas que cambian el estado de la base | Resultados no reproducibles | Restablecer datos antes de cada ciclo de ejecución |

## 14. Control de versiones del documento

| Versión | Fecha | Autor | Cambio |
| --- | --- | --- | --- |
| 1.0 | 2026-10-24 | [Nombre] | Creación del plan y de la matriz de casos |
