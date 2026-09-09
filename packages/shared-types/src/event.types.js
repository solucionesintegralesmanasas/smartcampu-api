/**
 * Catálogo canónico de eventos de dominio.
 *
 * Cada evento representa un hecho significativo ocurrido en un servicio
 * que puede ser consumido por otros servicios (arquitectura basada en eventos).
 *
 * Convención:
 *   - Los eventos se publican en colas BullMQ.
 *   - Cada evento tiene un emisor canónico y uno o varios consumidores.
 *   - Los nombres de cola siguen el patrón: `uajs.<dominio>.<evento>.<version>`.
 *
 * @module event.types
 */

// ============================================================================
// Tipos de eventos (constantes canónicas)
// ============================================================================

const EVENT_TYPES = Object.freeze({
  SOLICITUD_CREADA: 'SolicitudCreadaEvent',
  SOLICITUD_ESTADO_CAMBIADO: 'SolicitudEstadoCambiadoEvent',
  RESERVA_CONFIRMADA: 'ReservaConfirmadaEvent',
  EVENTO_PROGRAMADO: 'EventoProgramadoEvent',
  PQRS_RESPONDIDA: 'PqrsRespondidaEvent',
  NOTIFICACION_GENERADA: 'NotificacionGeneradaEvent',
});

// ============================================================================
// Colas BullMQ canónicas por evento
// ============================================================================

/**
 * Map: tipo de evento → nombre de cola BullMQ.
 *
 * @type {Readonly<Record<string, string>>}
 */
const EVENT_QUEUES = Object.freeze({
  [EVENT_TYPES.SOLICITUD_CREADA]: 'uajs.solicitudes.creadas.v1',
  [EVENT_TYPES.SOLICITUD_ESTADO_CAMBIADO]: 'uajs.solicitudes.estado.v1',
  [EVENT_TYPES.RESERVA_CONFIRMADA]: 'uajs.reservas.confirmadas.v1',
  [EVENT_TYPES.EVENTO_PROGRAMADO]: 'uajs.eventos.programados.v1',
  [EVENT_TYPES.PQRS_RESPONDIDA]: 'uajs.pqrs.respondidas.v1',
  [EVENT_TYPES.NOTIFICACION_GENERADA]: 'uajs.notificaciones.generadas.v1',
});

// ============================================================================
// EVENT_REGISTRY: emisor, consumidor(es) y cola por cada evento
// ============================================================================

/**
 * Registro canónico de eventos.
 *
 * Cada entrada describe:
 *   - emisor: servicio que publica el evento.
 *   - consumidor: servicio(s) que lo consumen.
 *   - queue: nombre de la cola BullMQ.
 *
 * @type {Readonly<Record<string, { emisor: string, consumidor: string[], queue: string, descripcion: string }>>}
 */
const EVENT_REGISTRY = Object.freeze({
  [EVENT_TYPES.SOLICITUD_CREADA]: Object.freeze({
    emisor: 'solicitudes-service',
    consumidor: ['notificaciones-service'],
    queue: EVENT_QUEUES[EVENT_TYPES.SOLICITUD_CREADA],
    descripcion:
      'Se ha creado una nueva solicitud. Los consumidores deben notificar al usuario y/o al responsable.',
  }),

  [EVENT_TYPES.SOLICITUD_ESTADO_CAMBIADO]: Object.freeze({
    emisor: 'solicitudes-service',
    consumidor: ['notificaciones-service'],
    queue: EVENT_QUEUES[EVENT_TYPES.SOLICITUD_ESTADO_CAMBIADO],
    descripcion:
      'Una solicitud cambió de estado. Los consumidores deben notificar al usuario solicitante.',
  }),

  [EVENT_TYPES.RESERVA_CONFIRMADA]: Object.freeze({
    emisor: 'reservas-service',
    consumidor: ['notificaciones-service', 'calendario-service'],
    queue: EVENT_QUEUES[EVENT_TYPES.RESERVA_CONFIRMADA],
    descripcion:
      'Una reserva fue confirmada. Se notifica al usuario y se sincroniza con el calendario.',
  }),

  [EVENT_TYPES.EVENTO_PROGRAMADO]: Object.freeze({
    emisor: 'eventos-service',
    consumidor: ['notificaciones-service'],
    queue: EVENT_QUEUES[EVENT_TYPES.EVENTO_PROGRAMADO],
    descripcion: 'Se programó un nuevo evento institucional. Se difunde a la comunidad.',
  }),

  [EVENT_TYPES.PQRS_RESPONDIDA]: Object.freeze({
    emisor: 'pqrs-service',
    consumidor: ['notificaciones-service'],
    queue: EVENT_QUEUES[EVENT_TYPES.PQRS_RESPONDIDA],
    descripcion: 'Una PQRS fue respondida por un funcionario. Se notifica al peticionario.',
  }),

  [EVENT_TYPES.NOTIFICACION_GENERADA]: Object.freeze({
    emisor: 'notificaciones-service',
    consumidor: ['emails-service', 'audit-service'],
    queue: EVENT_QUEUES[EVENT_TYPES.NOTIFICACION_GENERADA],
    descripcion:
      'Se generó una notificación. El servicio de emails la entrega por el canal correspondiente y audit la registra.',
  }),
});

// ============================================================================
// JSDoc de los payloads de cada evento
// ============================================================================

/**
 * @typedef {Object} SolicitudCreadaEvent
 * @property {'SolicitudCreadaEvent'} type
 * @property {string} solicitudUuid
 * @property {string} numero_solicitud
 * @property {number} usuarioId
 * @property {string} tipoSolicitud
 * @property {string} descripcion
 * @property {string} timestamp - ISO8601.
 */

/**
 * @typedef {Object} SolicitudEstadoCambiadoEvent
 * @property {'SolicitudEstadoCambiadoEvent'} type
 * @property {string} solicitudUuid
 * @property {string} estadoAnterior
 * @property {string} estadoNuevo
 * @property {number} usuarioId
 * @property {string} timestamp
 */

/**
 * @typedef {Object} ReservaConfirmadaEvent
 * @property {'ReservaConfirmadaEvent'} type
 * @property {string} reservaUuid
 * @property {number} recursoId
 * @property {number} usuarioId
 * @property {string} fechaReserva
 * @property {string} horaInicio
 * @property {string} horaFin
 * @property {string} timestamp
 */

/**
 * @typedef {Object} EventoProgramadoEvent
 * @property {'EventoProgramadoEvent'} type
 * @property {string} eventoUuid
 * @property {string} nombre
 * @property {string} fechaEvento
 * @property {string} horaEvento
 * @property {string} sedeNombre
 * @property {string} timestamp
 */

/**
 * @typedef {Object} PqrsRespondidaEvent
 * @property {'PqrsRespondidaEvent'} type
 * @property {string} pqrsUuid
 * @property {string} tipoPqrs
 * @property {string} respuesta
 * @property {number} usuarioRespondeId
 * @property {string} timestamp
 */

/**
 * @typedef {Object} NotificacionGeneradaEvent
 * @property {'NotificacionGeneradaEvent'} type
 * @property {string} notificacionUuid
 * @property {number} usuarioId
 * @property {string} tipoNotificacion
 * @property {string} titulo
 * @property {string} timestamp
 */

/**
 * Unión de todos los eventos posibles.
 * @typedef {SolicitudCreadaEvent | SolicitudEstadoCambiadoEvent | ReservaConfirmadaEvent | EventoProgramadoEvent | PqrsRespondidaEvent | NotificacionGeneradaEvent} DomainEvent
 */

module.exports = {
  EVENT_TYPES,
  EVENT_QUEUES,
  EVENT_REGISTRY,
};
