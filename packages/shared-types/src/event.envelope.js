const crypto = require('crypto');

/**
 * Versión del contrato de envelope. Se incrementa solo ante cambios incompatibles.
 */
const ENVELOPE_VERSION = 1;

/**
 * Construye el envelope estándar de un evento de dominio.
 *
 * Forma:
 *   { eventId, eventType, occurredAt, source, version, payload }
 *
 * - eventId: UUID v4, usado por los consumidores para ser idempotentes.
 * - occurredAt: ISO 8601 en UTC.
 *
 * @param {Object} params
 * @param {string} params.eventType - Constante de EVENT_TYPES.
 * @param {string} params.source - Servicio emisor (ej. 'booking-service').
 * @param {Object} [params.payload] - Datos específicos del evento.
 * @param {number} [params.version] - Versión del contrato del evento.
 * @returns {Readonly<Object>}
 */
const createEventEnvelope = ({
  eventType,
  source,
  payload = {},
  version = ENVELOPE_VERSION,
}) => {
  if (!eventType || !source) {
    throw new Error('createEventEnvelope: eventType y source son obligatorios');
  }

  return Object.freeze({
    eventId: crypto.randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    source,
    version,
    payload: Object.freeze({ ...payload }),
  });
};

module.exports = {
  ENVELOPE_VERSION,
  createEventEnvelope,
};
