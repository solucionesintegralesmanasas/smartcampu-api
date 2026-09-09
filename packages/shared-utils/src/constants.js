/**
 * Catálogo canónico de códigos de error de la plataforma UAJS.
 * Se usan en formatError() y en middlewares de error.
 */
const ERROR_CODES = Object.freeze({
  // 4xx — Cliente
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // 5xx — Servidor
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_GATEWAY: 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
});

/**
 * Mapeo código canónico → status HTTP.
 */
const HTTP_STATUS = Object.freeze({
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.ROUTE_NOT_FOUND]: 404,
  [ERROR_CODES.METHOD_NOT_ALLOWED]: 405,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.UNPROCESSABLE_ENTITY]: 422,
  [ERROR_CODES.PAYLOAD_TOO_LARGE]: 413,
  [ERROR_CODES.UNSUPPORTED_MEDIA_TYPE]: 415,
  [ERROR_CODES.TOO_MANY_REQUESTS]: 429,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.BAD_GATEWAY]: 502,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.GATEWAY_TIMEOUT]: 504,
});

/**
 * TTLs canónicos de tokens (en minutos o días, según el campo).
 */
const TOKEN_TTLS = Object.freeze({
  JWT_ACCESS_TTL_MIN: 15,
  JWT_REFRESH_TTL_DAYS: 7,
  RESET_PASSWORD_TOKEN_TTL_MIN: 30,
});

/**
 * Parámetros de paginación por defecto.
 */
const DEFAULT_PAGINATION = Object.freeze({
  page: 1,
  size: 20,
  maxPageSize: 100,
});

/**
 * Mapeo de códigos de error MySQL (err.code) → respuesta canónica.
 * Usado por `translateMysqlError` en los servicios.
 */
const MYSQL_ERROR_MAP = Object.freeze({
  ER_DUP_ENTRY: {
    statusCode: 409,
    code: ERROR_CODES.CONFLICT,
    message: 'El recurso ya existe (clave duplicada)',
  },
  ER_NO_REFERENCED_ROW: {
    statusCode: 422,
    code: ERROR_CODES.UNPROCESSABLE_ENTITY,
    message: 'Referencia integrity violation: el registro relacionado no existe',
  },
  ER_NO_REFERENCED_ROW_2: {
    statusCode: 422,
    code: ERROR_CODES.UNPROCESSABLE_ENTITY,
    message: 'Referencia integrity violation: el registro relacionado no existe',
  },
  ER_ROW_IS_REFERENCED_2: {
    statusCode: 409,
    code: ERROR_CODES.CONFLICT,
    message: 'No se puede eliminar: existen registros dependientes',
  },
  ER_DATA_TOO_LONG: {
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: 'Un campo excede la longitud máxima permitida',
  },
  ER_BAD_NULL_ERROR: {
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: 'Un campo obligatorio es nulo',
  },
  ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: {
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: 'Valor inválido para el campo',
  },
  ER_WRONG_VALUE_COUNT_ON_ROW: {
    statusCode: 400,
    code: ERROR_CODES.VALIDATION_ERROR,
    message: 'Número de columnas no coincide con los valores',
  },
  ER_PARSE_ERROR: {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Error de sintaxis SQL',
  },
  ER_ACCESS_DENIED_ERROR: {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Acceso denegado a la base de datos',
  },
  ER_DBACCESS_DENIED_ERROR: {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Acceso denegado a la base de datos',
  },
  ER_BAD_DB_ERROR: {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Base de datos inexistente',
  },
  ER_LOCK_WAIT_TIMEOUT: {
    statusCode: 409,
    code: ERROR_CODES.CONFLICT,
    message: 'Timeout esperando bloqueo de fila',
  },
  ER_LOCK_DEADLOCK: {
    statusCode: 409,
    code: ERROR_CODES.CONFLICT,
    message: 'Deadlock detectado, reintente la operación',
  },
  ER_QUERY_INTERRUPTED: {
    statusCode: 504,
    code: ERROR_CODES.GATEWAY_TIMEOUT,
    message: 'La consulta fue interrumpida',
  },
});

/**
 * Traduce un error de MySQL2 a un objeto canónico listo para formatError().
 *
 * @param {Error & { code?: string, errno?: number, sqlMessage?: string }} err
 * @returns {{ statusCode: number, code: string, message: string }}
 */
function translateMysqlError(err) {
  const mapped = err?.code ? MYSQL_ERROR_MAP[err.code] : null;
  if (mapped) {
    return { ...mapped };
  }
  return {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: err?.message || 'Error interno de base de datos',
  };
}

module.exports = {
  ERROR_CODES,
  HTTP_STATUS,
  TOKEN_TTLS,
  DEFAULT_PAGINATION,
  MYSQL_ERROR_MAP,
  translateMysqlError,
};
