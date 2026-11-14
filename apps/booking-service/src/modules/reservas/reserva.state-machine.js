const { ConflictError } = require('../../core/exceptions');

/**
 * Códigos de booking_statuses (ver scripts/seed/ms-bookings_001_seed.sql).
 */
const ESTADOS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
});

/**
 * Transiciones permitidas. Cualquier otra transición se rechaza.
 * pending -> approved | rejected
 * approved -> confirmed
 * confirmed -> completed | cancelled | no_show
 */
const TRANSICIONES = Object.freeze({
  [ESTADOS.PENDING]: Object.freeze([ESTADOS.APPROVED, ESTADOS.REJECTED]),
  [ESTADOS.APPROVED]: Object.freeze([ESTADOS.CONFIRMED]),
  [ESTADOS.CONFIRMED]: Object.freeze([ESTADOS.COMPLETED, ESTADOS.CANCELLED, ESTADOS.NO_SHOW]),
  [ESTADOS.REJECTED]: Object.freeze([]),
  [ESTADOS.CANCELLED]: Object.freeze([]),
  [ESTADOS.COMPLETED]: Object.freeze([]),
  [ESTADOS.NO_SHOW]: Object.freeze([]),
});

const ESTADOS_VALIDOS = Object.freeze(Object.values(ESTADOS));

/**
 * Estados que ocupan el horario de un recurso (bloquean nuevas reservas solapadas).
 */
const ESTADOS_BLOQUEANTES = Object.freeze([ESTADOS.PENDING, ESTADOS.APPROVED, ESTADOS.CONFIRMED]);

const transicionesPermitidas = (origen) => [...(TRANSICIONES[origen] || [])];

const esTransicionPermitida = (origen, destino) =>
  transicionesPermitidas(origen).includes(destino);

const esEstadoTerminal = (estado) => transicionesPermitidas(estado).length === 0;

/**
 * Valida una transición y lanza ConflictError si no está permitida.
 * @param {string} origen - Estado actual.
 * @param {string} destino - Estado solicitado.
 * @returns {true}
 */
const assertTransicion = (origen, destino) => {
  if (!esTransicionPermitida(origen, destino)) {
    throw new ConflictError(`No se permite cambiar una reserva de '${origen}' a '${destino}'`);
  }
  return true;
};

module.exports = {
  ESTADOS,
  ESTADOS_VALIDOS,
  ESTADOS_BLOQUEANTES,
  TRANSICIONES,
  transicionesPermitidas,
  esTransicionPermitida,
  esEstadoTerminal,
  assertTransicion,
};
