// eslint-disable-next-line import/no-extraneous-dependencies
const { USER_ROLES } = require('@uajs/shared-types');

const CANALES = Object.freeze({
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
  SMS: 'sms',
});

/** Canales que se entregan por adaptador externo y respetan preferencias. */
const CANALES_ENTREGA = Object.freeze([CANALES.EMAIL, CANALES.PUSH]);

const CANALES_PLANTILLA = Object.freeze(Object.values(CANALES));

const ESTADOS = Object.freeze({
  QUEUED: 'queued',
  SENDING: 'sending',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  READ: 'read',
});

/** Categorías de preferencias; corresponden al prefijo del código de plantilla. */
const CATEGORIAS = Object.freeze(['request', 'booking', 'event', 'pqrs']);

/**
 * UUID centinela para difusiones a la comunidad. La columna recipient_uuid es NOT NULL,
 * por eso una difusión se guarda con este destinatario en lugar de NULL.
 */
const DESTINATARIO_DIFUSION = '00000000-0000-0000-0000-000000000000';

const ROLES_GESTION = Object.freeze([USER_ROLES.ADMIN, USER_ROLES.STAFF]);

const ENTREGA = Object.freeze({
  INTENTOS: 5,
  BACKOFF_MS: 1000,
});

const MOTIVOS = Object.freeze({
  CANAL_DESACTIVADO: 'Omitida: canal desactivado por preferencias del usuario',
  SIN_CORREO: 'El destinatario no tiene correo electrónico registrado',
  SIN_SUSCRIPCION: 'El usuario no tiene suscripciones push activas',
  NO_ENCOLADO: 'No se pudo encolar la entrega',
});

/**
 * Obtiene la categoría de preferencias a partir del código de plantilla.
 * @param {string} code - Código de plantilla, ej. 'request.created'.
 * @returns {string} Categoría, ej. 'request'.
 */
const categoriaDePlantilla = (code) => String(code).split('.')[0];

/**
 * Identificador de destinatario usado en las columnas *_uuid.
 * El JWT sólo trae el id numérico del usuario (sub), por eso se guarda como texto.
 * @param {number|string} usuarioId
 * @returns {string}
 */
const destinatarioDe = (usuarioId) => String(usuarioId);

module.exports = {
  CANALES,
  CANALES_ENTREGA,
  CANALES_PLANTILLA,
  ESTADOS,
  CATEGORIAS,
  DESTINATARIO_DIFUSION,
  ROLES_GESTION,
  ENTREGA,
  MOTIVOS,
  categoriaDePlantilla,
  destinatarioDe,
};
