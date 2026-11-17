const { ConflictError } = require('../../core/exceptions');

/**
 * Estados del ciclo de vida de una PQRS (códigos de pqrs_statuses).
 */
const ESTADOS = Object.freeze({
  RADICADA: 'radicada',
  EN_TRAMITE: 'en_tramite',
  RESPONDIDA: 'respondida',
  CERRADA: 'cerrada',
});

/**
 * Transiciones permitidas. Cualquier otra transición es un conflicto.
 * - radicada -> en_tramite (asignación), radicada -> cerrada (rechazo por duplicado, solo ADMIN).
 * - en_tramite -> respondida.
 * - respondida -> cerrada, respondida -> en_tramite (reapertura).
 */
const TRANSICIONES = Object.freeze({
  [ESTADOS.RADICADA]: [ESTADOS.EN_TRAMITE, ESTADOS.CERRADA],
  [ESTADOS.EN_TRAMITE]: [ESTADOS.RESPONDIDA],
  [ESTADOS.RESPONDIDA]: [ESTADOS.CERRADA, ESTADOS.EN_TRAMITE],
  [ESTADOS.CERRADA]: [],
});

/**
 * Estados desde los que se permite calificar (satisfaction_score).
 */
const ESTADOS_CALIFICABLES = Object.freeze([ESTADOS.RESPONDIDA, ESTADOS.CERRADA]);

/**
 * Lista las transiciones válidas desde un estado.
 * @param {string} desde
 * @returns {string[]}
 */
const transicionesPermitidas = (desde) => (Object.hasOwn(TRANSICIONES, desde) ? [...TRANSICIONES[desde]] : []);

/**
 * Indica si la transición entre dos estados está permitida.
 * @param {string} desde
 * @param {string} hacia
 * @returns {boolean}
 */
const puedeTransicionar = (desde, hacia) => transicionesPermitidas(desde).includes(hacia);

/**
 * Valida una transición de estado.
 * @param {string} desde
 * @param {string} hacia
 * @returns {true}
 * @throws {ConflictError} Si la transición no está permitida.
 */
const validarTransicion = (desde, hacia) => {
  if (!puedeTransicionar(desde, hacia)) {
    throw new ConflictError(`Transición de estado no permitida: de '${desde}' a '${hacia}'`);
  }
  return true;
};

module.exports = {
  ESTADOS,
  TRANSICIONES,
  ESTADOS_CALIFICABLES,
  transicionesPermitidas,
  puedeTransicionar,
  validarTransicion,
};
