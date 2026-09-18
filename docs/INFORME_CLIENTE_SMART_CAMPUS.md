# UAJS Smart Campus — Informe Ejecutivo para Cliente

**Corporación Universitaria Antonio José de Sucre | Plataforma de Servicios Universitarios**
**Duración exposición: 15 minutos | Enfoque: Negocio + Técnico general**

> Guía de tiempo: 1-Resumen (2') → 2-Valor (2') → 3-Demo UX (3') → 4-Arquitectura (3') → 5-Tecnología (2') → 6-Seguridad (2') → 7-Roadmap (1')

---

## 1. Resumen Ejecutivo (2 min)

**UAJS Smart Campus es “Tu campus, conectado”.**

Una plataforma única donde estudiante y docente inician sesión una vez y acceden a todo: perfil académico, solicitudes, reservas de espacios, eventos, notificaciones, PQRS y archivos.

- **1 puerta de entrada:** API Gateway `/api/v1` + App Web React.
- **12 dominios universitarios** bajo la misma identidad y seguridad.
- **Núcleo operativo:** Identidad (Auth), Universidad (programas, facultades, estudiantes, docentes, terceros, empresas), Catálogos (sedes, ciudades, facultades, tipos de documento) y Archivos.
- **Objetivo:** eliminar trámites dispersos, dar trazabilidad total y crecer por módulos sin re-hacer lo ya construido.

## 2. Valor para la Universidad (2 min)

| Necesidad            | Lo que entrega Smart Campus                                               |
| -------------------- | ------------------------------------------------------------------------- |
| Identidad única      | Login con correo institucional, sesión recordada, recuperación de clave   |
| Ficha académica real | Perfil con programa, código, semestre, promedio / datos docente, facultad |
| Trámites ordenados   | Solicitudes, PQRS con respuestas y estados                                |
| Uso de campus        | Reservas de aulas, laboratorios, auditorios, escenarios deportivos        |
| Vida universitaria   | Eventos, notificaciones, catálogo de servicios con buscador               |
| Gestión documental   | Carga, búsqueda y descarga de archivos                                    |

**Beneficio directo:** menos filas y papeles, más autogestión, datos centralizados para decisiones.

## 3. Experiencia de Usuario - Qué verá en la demo (3 min)

Flujo actual en la App Web:

1.  **Landing `/`:** Hero “Tu campus, conectado…” + tarjeta “Inicia sesión” (email + password + Recordarme).
2.  **Home `/home`:** Saludo “Hola, {nombre}”, 5 indicadores (solicitudes, reservas, notificaciones, eventos, servicios) + buscador global “Buscar servicios, solicitudes, recursos…”.
3.  **Perfil `/perfil`:** Avatar, nombre, rol, correo + datos académicos y actividad reciente.
4.  **Menú lateral permanente:** Inicio, Solicitudes, Reservas, Eventos, Notificaciones, Perfil + Header con búsqueda y “salir” + Footer institucional.

Todo navega sin recargar (SPA), con diseño propio institucional y logo UAJS.

## 4. Arquitectura Simple (3 min)

```
[ App Web React ] → [ API Gateway :3000 /api/v1 ] → Microservicios
                                                          ├─ /auth → Identidad
                                                          ├─ /universidad → Academia
                                                          ├─ /catalogos → Sedes y datos base
                                                          ├─ /archivos → Documentos
                                                          ├─ /reservas, /solicitudes, /eventos,
                                                             /notificaciones, /pqrs, /recursos, /usuarios
                     ↓
            [ MySQL 8 ]  [ Redis 7 ]  [ Elasticsearch + Kibana ]
              Dato oficial   Rapidez      Búsqueda y auditoría
```

- **Monorepo ordenado:** `apps/` (servicios) + `packages/` (librerías compartidas) + `infrastructure/` (Docker/K8s).
- **Patrón estándar por servicio:** `controller → service → repository → validation → routes` + colas asíncronas (BullMQ) para correos y tareas.
- **Escalable:** se activa un nuevo módulo conectándolo al Gateway, sin tocar login ni perfil.

## 5. Tecnología (2 min)

- **Frontend:** React 18 + Vite 5 + React Router 6, iconografía Lucide. Rápido y estándar.
- **Backend:** Node.js 20 + Express 4 + validación Zod + documentación Swagger.
- **Datos:** MySQL 8 (transaccional), Redis (caché y sesiones), Elasticsearch 8 (búsqueda avanzada).
- **Integración:** `VITE_API_BASE_URL=http://localhost:3000/api/v1` → todo pasa por el Gateway con `Authorization: Bearer`.
- **Operación:** Docker + Kubernetes + Nginx listos, `npm run dev / build / test / lint`, healthchecks `/health`.

## 6. Seguridad y Confianza (2 min)

- JWT Access 15 min + Refresh 7 días, cifrado de claves con bcrypt.
- Roles `ESTUDIANTE, DOCENTE, ADMIN` + permisos, propagados como `X-User-Id / X-User-Roles`.
- Protección: Helmet, CORS, Rate-Limit, validación de datos, Circuit-Breaker, `X-Request-Id` para trazabilidad.
- Buenas prácticas: contenedores non-root, secretos solo en `.env`, TLS, backups y logs centralizados.

## 7. Roadmap y Siguientes Pasos (1 min)

1.  **Fase actual entregada:** identidad, academia, catálogos, archivos y base visual de los 6 módulos.
2.  **Fase 2 inmediata:** encender Solicitudes → Reservas → Eventos → Notificaciones → PQRS sobre el menú ya listo.
3.  **Compromiso:** cero retrabajo en login/perfil, cada módulo nuevo hereda seguridad, auditoría y búsqueda.

**Mensaje de cierre:** _La base está lista. El campus ya se autentica y se reconoce. Ahora escalamos servicios a la velocidad que la universidad pida._

---

_Generado desde análisis de código: `smartcampu-api/` + `uajs-smart-campus/` – Feb 2026. Archivo: `docs/INFORME_CLIENTE_SMART_CAMPUS.md`_
