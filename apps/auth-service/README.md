# Servicio de Autenticación Enterprise

Servicio encargado de la gestión de identidad, autenticación, renovación de tokens y registro de eventos de seguridad en Elasticsearch.

## Características

- Registro e inicio de sesión con JWT (Access 15m, Refresh 7d).
- Recuperación de contraseña asíncrona mediante BullMQ.
- Indexación de eventos de seguridad en Elasticsearch.
- Validación de esquemas con Zod.
- Circuit Breaker en conexiones a Redis.

## Instalación

```bash
npm install
cp .env.example .env
npm run dev
```
