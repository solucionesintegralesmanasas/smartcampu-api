const { ConflictError } = require('../../core/exceptions');

/**
 * Estados del ciclo de vida de una solicitud (códigos de request_statuses).
 */
const ESTADOS = Object.freeze({
  PENDING: 'pending',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CLOSED: 'closed',
});

/**
 * Transiciones permitidas por defecto. Cualquier otra transición es un conflicto.
 */
const TRANSICIONES = Object.freeze({
  [ESTADOS.PENDING]: [ESTADOS.IN_REVIEW],
  [ESTADOS.IN_REVIEW]: [ESTADOS.APPROVED, ESTADOS.REJECTED],
  [ESTADOS.APPROVED]: [ESTADOS.CLOSED],
  [ESTADOS.REJECTED]: [ESTADOS.CLOSED],
  [ESTADOS.CLOSED]: [],
});

/**
 * Excepción para tipos que no requieren aprobación (request_types.requires_approval = 0):
 * pueden pasar de pending a approved sin pasar por in_review.
 */
const TRANSICIONES_SIN_APROBACION = Object.freeze({
  [ESTADOS.PENDING]: [ESTADOS.APPROVED],
});

/**
 * Lista las transiciones válidas desde un estado.
 * @param {string} desde - Estado actual.
 * @param {{ requiereAprobacion?: boolean }} [opciones]
 * @returns {string[]}
 */
const transicionesPermitidas = (desde, { requiereAprobacion = true } = {}) => {
  const base = Object.hasOwn(TRANSICIONES, desde) ? TRANSICIONES[desde] : [];
  if (requiereAprobacion) {
    return [...base];
  }
  const excepcion = Object.hasOwn(TRANSICIONES_SIN_APROBACION, desde)
    ? TRANSICIONES_SIN_APROBACION[desde]
    : [];
  return [...new Set([...base, ...excepcion])];
};

/**
 * Indica si la transición entre dos estados está permitida.
 * @param {string} desde
 * @param {string} hacia
 * @param {{ requiereAprobacion?: boolean }} [opciones]
 * @returns {boolean}
 */
const puedeTransicionar = (desde, hacia, opciones) =>
  transicionesPermitidas(desde, opciones).includes(hacia);

/**
 * Valida una transición de estado.
 * @param {string} desde
 * @param {string} hacia
 * @param {{ requiereAprobacion?: boolean }} [opciones]
 * @returns {true}
 * @throws {ConflictError} Si la transición no está permitida.
 */
const validarTransicion = (desde, hacia, opciones) => {
  if (!puedeTransicionar(desde, hacia, opciones)) {
    throw new ConflictError(`Transición de estado no permitida: de '${desde}' a '${hacia}'`);
  }
  return true;
};

module.exports = {
  ESTADOS,
  TRANSICIONES,
  TRANSICIONES_SIN_APROBACION,
  transicionesPermitidas,
  puedeTransicionar,
  validarTransicion,
};
