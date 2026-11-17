const { ConflictError } = require('../../core/exceptions');

/**
 * Estados del ciclo de vida de un evento (códigos de event_statuses).
 * draft → published → ongoing → completed; published → cancelled.
 */
const ESTADOS_EVENTO = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

const TRANSICIONES_EVENTO = Object.freeze({
  [ESTADOS_EVENTO.DRAFT]: Object.freeze([ESTADOS_EVENTO.PUBLISHED]),
  [ESTADOS_EVENTO.PUBLISHED]: Object.freeze([ESTADOS_EVENTO.ONGOING, ESTADOS_EVENTO.CANCELLED]),
  [ESTADOS_EVENTO.ONGOING]: Object.freeze([ESTADOS_EVENTO.COMPLETED]),
  [ESTADOS_EVENTO.COMPLETED]: Object.freeze([]),
  [ESTADOS_EVENTO.CANCELLED]: Object.freeze([]),
});

/** Estados visibles para usuarios sin rol de gestión. */
const ESTADOS_PUBLICOS = Object.freeze([
  ESTADOS_EVENTO.PUBLISHED,
  ESTADOS_EVENTO.ONGOING,
  ESTADOS_EVENTO.COMPLETED,
]);

/**
 * Estados a los que puede pasar un evento desde `estado`.
 * @param {string} estado
 * @returns {string[]}
 */
const siguientesEstados = (estado) =>
  Object.prototype.hasOwnProperty.call(TRANSICIONES_EVENTO, estado)
    ? [...TRANSICIONES_EVENTO[estado]]
    : [];

/**
 * @param {string} desde - Estado actual.
 * @param {string} hacia - Estado solicitado.
 * @returns {boolean}
 */
const puedeTransicionar = (desde, hacia) => siguientesEstados(desde).includes(hacia);

/**
 * Valida una transición de estado.
 * @throws {ConflictError} Si la transición no está permitida.
 */
const validarTransicion = (desde, hacia) => {
  if (!puedeTransicionar(desde, hacia)) {
    throw new ConflictError(`No se puede cambiar el estado del evento de '${desde}' a '${hacia}'`);
  }
};

/**
 * @param {string} estado
 * @returns {boolean} Si el estado es visible públicamente.
 */
const esEstadoPublico = (estado) => ESTADOS_PUBLICOS.includes(estado);

/**
 * Un evento se puede editar en borrador, o publicado sin inscritos activos.
 * @param {string} estado
 * @param {boolean} tieneInscritos
 * @returns {boolean}
 */
const puedeEditarse = (estado, tieneInscritos) =>
  estado === ESTADOS_EVENTO.DRAFT ||
  (estado === ESTADOS_EVENTO.PUBLISHED && !tieneInscritos);

/**
 * @throws {ConflictError} Si el evento no admite edición en su estado actual.
 */
const validarEdicion = (estado, tieneInscritos) => {
  if (puedeEditarse(estado, tieneInscritos)) return;
  if (estado === ESTADOS_EVENTO.PUBLISHED) {
    throw new ConflictError('No se puede modificar un evento publicado que ya tiene inscritos');
  }
  throw new ConflictError('Solo se pueden modificar eventos en borrador o publicados sin inscritos');
};

/**
 * Solo los eventos en borrador se eliminan (soft delete).
 * @throws {ConflictError} Si el estado no permite eliminar.
 */
const validarEliminacion = (estado) => {
  if (estado !== ESTADOS_EVENTO.DRAFT) {
    throw new ConflictError('Solo se pueden eliminar eventos en borrador');
  }
};

module.exports = {
  ESTADOS_EVENTO,
  TRANSICIONES_EVENTO,
  ESTADOS_PUBLICOS,
  siguientesEstados,
  puedeTransicionar,
  validarTransicion,
  esEstadoPublico,
  puedeEditarse,
  validarEdicion,
  validarEliminacion,
};
