/**
 * Construye una respuesta de éxito canónica.
 *
 * @param {object} params
 * @param {*} [params.data=null]
 * @param {string} [params.message='OK']
 * @param {object|null} [params.meta=null]
 * @param {string} [params.code='OK']
 * @returns {{ success: true, code: string, message: string, data: *, meta: object|null }}
 */
function formatSuccess({
  data = null, message = 'OK', meta = null, code = 'OK',
} = {}) {
  return {
    success: true,
    code,
    message,
    data,
    meta,
  };
}

/**
 * Construye una respuesta de error canónica.
 *
 * @param {object} params
 * @param {string} params.code - Código canónico (ver ERROR_CODES).
 * @param {string} params.message - Mensaje legible.
 * @param {Array<object>|null} [params.errors=null] - Errores de validación detallados.
 * @param {string|null} [params.requestId=null] - ID de trazabilidad.
 * @param {number|null} [params.retryAfterSeconds=null] - Sugerencia de reintento (429/503).
 * @returns {{ success: false, code: string, message: string, data: null, meta: null, ... }}
 */
function formatError({
  code,
  message,
  errors = null,
  requestId = null,
  retryAfterSeconds = null,
} = {}) {
  if (!code || typeof code !== 'string') {
    throw new TypeError('formatError: "code" es obligatorio');
  }
  if (!message || typeof message !== 'string') {
    throw new TypeError('formatError: "message" es obligatorio');
  }

  const base = {
    success: false,
    code,
    message,
    data: null,
    meta: null,
  };

  if (errors !== null && errors !== undefined) base.errors = errors;
  if (requestId !== null && requestId !== undefined) base.requestId = requestId;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    base.retryAfterSeconds = retryAfterSeconds;
  }

  return base;
}

/**
 * Construye una respuesta paginada canónica.
 *
 * @param {object} params
 * @param {Array<*>} params.data
 * @param {number} params.total
 * @param {number} params.page - Página actual (1-based).
 * @param {number} params.size - Tamaño de página.
 * @returns {ReturnType<typeof formatSuccess>}
 */
function formatPaginated({
  data, total, page, size,
}) {
  if (!Array.isArray(data)) {
    throw new TypeError('formatPaginated: "data" debe ser un array');
  }
  if (!Number.isInteger(total) || total < 0) {
    throw new TypeError('formatPaginated: "total" debe ser entero >= 0');
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new TypeError('formatPaginated: "page" debe ser entero >= 1');
  }
  if (!Number.isInteger(size) || size < 1) {
    throw new TypeError('formatPaginated: "size" debe ser entero >= 1');
  }

  const totalPages = total === 0 ? 0 : Math.ceil(total / size);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return formatSuccess({
    data,
    message: 'OK',
    code: 'OK',
    meta: {
      pagination: {
        total,
        page,
        size,
        totalPages,
        hasNext,
        hasPrev,
      },
    },
  });
}

module.exports = {
  formatSuccess,
  formatError,
  formatPaginated,
};
