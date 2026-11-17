/** Estados de event_registrations.status (migración ms-events). */
const ESTADOS_INSCRIPCION = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  WAITLISTED: 'waitlisted',
  CANCELLED: 'cancelled',
  ATTENDED: 'attended',
});

/** Inscripciones que ocupan un cupo del aforo. */
const ESTADOS_QUE_OCUPAN_CUPO = Object.freeze([
  ESTADOS_INSCRIPCION.PENDING,
  ESTADOS_INSCRIPCION.CONFIRMED,
  ESTADOS_INSCRIPCION.ATTENDED,
]);

/** Inscripciones activas (no canceladas), usadas para bloquear cambios en eventos. */
const ESTADOS_ACTIVOS = Object.freeze([
  ESTADOS_INSCRIPCION.PENDING,
  ESTADOS_INSCRIPCION.CONFIRMED,
  ESTADOS_INSCRIPCION.WAITLISTED,
  ESTADOS_INSCRIPCION.ATTENDED,
]);

module.exports = { ESTADOS_INSCRIPCION, ESTADOS_QUE_OCUPAN_CUPO, ESTADOS_ACTIVOS };
