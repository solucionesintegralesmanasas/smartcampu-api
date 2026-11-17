const logger = require('../../config/logger');
const NotificacionRepository = require('../../modules/notificacion/notificacion.repository');
const NotificacionService = require('../../modules/notificacion/notificacion.service');

/**
 * Mapa de eventos de dominio → cómo convertirlos en una notificación in-app.
 * `sourceService`/`sourceEntity` alimentan `notifications.source_*` para
 * poder rastrear de qué microservicio y entidad vino cada notificación.
 */
const EVENT_DEFINITIONS = {
  reserva_approved: {
    sourceService: 'ms-bookings',
    sourceEntity: 'booking',
    subject: 'Reserva aprobada',
    body: (d) => `Tu reserva ${d.referenceLabel} fue aprobada.`,
  },
  reserva_rejected: {
    sourceService: 'ms-bookings',
    sourceEntity: 'booking',
    subject: 'Reserva rechazada',
    body: (d) => `Tu reserva ${d.referenceLabel} fue rechazada${d.comment ? `: ${d.comment}.` : '.'}`,
  },
  reserva_confirmed: {
    sourceService: 'ms-bookings',
    sourceEntity: 'booking',
    subject: 'Reserva confirmada',
    body: (d) => `Tu reserva ${d.referenceLabel} ha sido confirmada.`,
  },
  reserva_cancelled: {
    sourceService: 'ms-bookings',
    sourceEntity: 'booking',
    subject: 'Reserva cancelada',
    body: (d) => `Tu reserva ${d.referenceLabel} fue cancelada${d.comment ? `: ${d.comment}.` : '.'}`,
  },
  reserva_completed: {
    sourceService: 'ms-bookings',
    sourceEntity: 'booking',
    subject: 'Reserva completada',
    body: (d) => `Tu reserva ${d.referenceLabel} se marcó como completada.`,
  },
  solicitud_creada: {
    sourceService: 'ms-requests',
    sourceEntity: 'request',
    subject: 'Solicitud registrada',
    body: (d) => `Tu solicitud ${d.referenceLabel} fue registrada correctamente.`,
  },
  solicitud_in_review: {
    sourceService: 'ms-requests',
    sourceEntity: 'request',
    subject: 'Solicitud en revisión',
    body: (d) => `Tu solicitud ${d.referenceLabel} está siendo revisada.`,
  },
  solicitud_approved: {
    sourceService: 'ms-requests',
    sourceEntity: 'request',
    subject: 'Solicitud aprobada',
    body: (d) => `Tu solicitud ${d.referenceLabel} fue aprobada.`,
  },
  solicitud_rejected: {
    sourceService: 'ms-requests',
    sourceEntity: 'request',
    subject: 'Solicitud rechazada',
    body: (d) => `Tu solicitud ${d.referenceLabel} fue rechazada${d.comment ? `: ${d.comment}.` : '.'}`,
  },
  solicitud_closed: {
    sourceService: 'ms-requests',
    sourceEntity: 'request',
    subject: 'Solicitud cerrada',
    body: (d) => `Tu solicitud ${d.referenceLabel} fue cerrada.`,
  },
  evento_publicado: {
    sourceService: 'ms-events',
    sourceEntity: 'event',
    subject: 'Tu evento fue publicado',
    body: (d) => `El evento "${d.referenceLabel}" ya está publicado y visible para la comunidad.`,
  },
  inscripcion_confirmada: {
    sourceService: 'ms-events',
    sourceEntity: 'event_registration',
    subject: 'Inscripción confirmada',
    body: (d) => `Tu inscripción a "${d.referenceLabel}" fue confirmada.`,
  },
  inscripcion_lista_espera: {
    sourceService: 'ms-events',
    sourceEntity: 'event_registration',
    subject: 'En lista de espera',
    body: (d) => `Quedaste en lista de espera para "${d.referenceLabel}".`,
  },
  inscripcion_promovida: {
    sourceService: 'ms-events',
    sourceEntity: 'event_registration',
    subject: 'Cupo liberado: inscripción confirmada',
    body: (d) => `Se liberó un cupo: tu inscripción a "${d.referenceLabel}" ahora está confirmada.`,
  },
  pqrs_creada: {
    sourceService: 'ms-pqrs',
    sourceEntity: 'pqrs',
    subject: 'PQRS radicada',
    body: (d) => `Tu PQRS ${d.referenceLabel} fue radicada correctamente.`,
  },
  pqrs_in_review: {
    sourceService: 'ms-pqrs',
    sourceEntity: 'pqrs',
    subject: 'PQRS en revisión',
    body: (d) => `Tu PQRS ${d.referenceLabel} está siendo revisada.`,
  },
  pqrs_responded: {
    sourceService: 'ms-pqrs',
    sourceEntity: 'pqrs',
    subject: 'PQRS respondida',
    body: (d) => `Tu PQRS ${d.referenceLabel} ha sido respondida.`,
  },
  pqrs_closed: {
    sourceService: 'ms-pqrs',
    sourceEntity: 'pqrs',
    subject: 'PQRS cerrada',
    body: (d) => `Tu PQRS ${d.referenceLabel} fue cerrada.`,
  },
};

class DomainEventsConsumer {
  constructor(notificacionService = new NotificacionService(new NotificacionRepository())) {
    this.notificacionService = notificacionService;
  }

  async handle(eventType, data) {
    if (!data.recipientUuid) {
      // Sin destinatario no hay a quién notificar (ej. PQRS anónima).
      return { skipped: true, reason: 'no_recipient' };
    }

    const definition = EVENT_DEFINITIONS[eventType];
    if (!definition) {
      logger.warn('Evento de dominio desconocido, se ignora', { eventType });
      return { skipped: true, reason: 'unknown_event_type' };
    }

    const notificacion = await this.notificacionService.create({
      recipientUuid: data.recipientUuid,
      channel: 'in_app',
      subject: definition.subject,
      body: definition.body(data),
      sourceService: definition.sourceService,
      sourceEntity: definition.sourceEntity,
      sourceUuid: data.entityUuid,
      metadata: { eventType, entityId: data.entityId },
    });

    return { success: true, notificationId: notificacion.id };
  }
}

module.exports = { DomainEventsConsumer, EVENT_DEFINITIONS };
