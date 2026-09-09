# @uajs/shared-utils

Utilidades compartidas para los microservicios de UAJS Smart Campus:
Logger (Winston), utilidades crypto, formato de respuestas canónicas,
constantes y rate limiting (Token Bucket).

## Instalación

Este paquete es privado y se consume dentro del monorepo vía workspaces:

```bash
npm install @uajs/shared-utils
```

## Módulos

- `createLogger({ service, level })` — Logger Winston JSON en producción, legible en desarrollo. Soporta `logger.child({ requestId })` para trazabilidad.
- `hashPassword` / `comparePassword` / `generateToken` / `hashToken` / `generateUuid` — utilidades crypto (bcrypt + node:crypto).
- `formatSuccess` / `formatError` / `formatPaginated` — respuestas de API canónicas.
- `ERROR_CODES`, `HTTP_STATUS`, `TOKEN_TTLS`, `DEFAULT_PAGINATION`, `MYSQL_ERROR_MAP`, `translateMysqlError` — constantes y traducción de errores MySQL.
- `createTokenBucket` — rate limiting en memoria (ver abajo).

## Token Bucket

Algoritmo Token Bucket genérico, en memoria, para limitar el consumo por
`key` (IP, correo+IP, userId, etc.).

### Contrato `consume(key, cost)`

```js
const { createTokenBucket } = require('@uajs/shared-utils');

const bucket = createTokenBucket({ capacity: 10, refillPerSecond: 1 });
const result = bucket.consume('192.168.1.10', 1);
```

`consume(key, cost = 1)` devuelve:

| Campo               | Tipo           | Descripción                                                      |
| ------------------- | -------------- | ---------------------------------------------------------------- |
| `allowed`           | `boolean`      | `true` si se permitió el consumo (descontó `cost`).              |
| `remaining`         | `number`       | Tokens disponibles tras la operación.                            |
| `retryAfterSeconds` | `number\|null` | Segundos a esperar cuando fue denegado; `null` si fue permitido. |

Otros métodos:

- `getRemaining(key)` → tokens actuales disponibles (con refill perezoso).
- `sweep()` → elimina cubetas inactivas (sin uso en `idleThresholdMs`).
- `stop()` → detiene el barrido periódico (llamar en graceful shutdown).

### Limitación: una sola réplica

> ⚠️ Este bucket vive **en memoria local del proceso**. Es correcto para una
> sola instancia por proceso (Node es single-threaded en su event-loop). En
> despliegues **multi-réplica**, el contador no es global: cada instancia
> tendría su propio bucket. Para escalar horizontalmente se requiere un
> store compartido (p. ej. Redis con un script Lua atómico).
