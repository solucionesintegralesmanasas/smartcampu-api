// eslint-disable-next-line import/no-extraneous-dependencies
const { EVENT_QUEUES, EVENT_TYPES } = require('@uajs/shared-types');

const { env } = require('../../config/env');
const logger = require('../../config/logger');
const { createWorker } = require('../../config/queues');
const EventIdempotencyStore = require('../../core/services/event-idempotency.store');

/**
 * Consumidores de eventos de dominio. Cada evento se traduce a una notificación
 * (a un usuario o difusión) y se publica NotificacionGeneradaEvent.
 *
 * Los payloads siguen el JSDoc de packages/shared-types/src/event.types.js.
 */
class EventsConsumer {
  /**
   * @param {import('../../core/services/notification-dispatcher.service')} dispatcher
   * @param {EventIdempotencyStore} [idempotency]
   */
  constructor(dispatcher, idempotency = new EventIdempotencyStore()) {
    this.dispatcher = dispatcher;
    this.idempotency = idempotency;
    this.workers = [];
    this.manejadores = this.construirManejadores();
  }

  construirManejadores() {
    return {
      [EVENT_TYPES.SOLICITUD_CREADA]: (payload) => this.dispatcher.notifyUser({
        recipientId: payload.usuarioId,
        templateCode: 'request.created',
        variables: {
          numero_solicitud: payload.numero_solicitud,
          tipo_tramite: payload.tipoSolicitud,
          descripcion: payload.descripcion,
        },
        source: { service: 'request-service', entity: 'solicitud', uuid: payload.solicitudUuid },
      }),

      [EVENT_TYPES.SOLICITUD_ESTADO_CAMBIADO]: (payload) => this.dispatcher.notifyUser({
        recipientId: payload.usuarioId,
        templateCode: 'request.status_changed',
        variables: {
          codigo_tramite: payload.solicitudUuid,
          tipo_tramite: payload.tipoSolicitud,
          nuevo_estado: payload.estadoNuevo,
        },
        source: { service: 'request-service', entity: 'solicitud', uuid: payload.solicitudUuid },
      }),

      [EVENT_TYPES.RESERVA_CONFIRMADA]: (payload) => this.dispatcher.notifyUser({
        recipientId: payload.usuarioId,
        templateCode: 'booking.confirmed',
        variables: {
          recurso: payload.recursoId,
          fecha: payload.fechaReserva,
          hora_inicio: payload.horaInicio,
          hora_fin: payload.horaFin,
        },
        source: { service: 'booking-service', entity: 'reserva', uuid: payload.reservaUuid },
      }),

      [EVENT_TYPES.EVENTO_PROGRAMADO]: (payload) => this.dispatcher.notifyBroadcast({
        templateCode: 'event.scheduled',
        variables: {
          nombre: payload.nombre,
          fecha: payload.fechaEvento,
          hora: payload.horaEvento,
          sede: payload.sedeNombre,
        },
        source: { service: 'event-service', entity: 'evento', uuid: payload.eventoUuid },
      }),

      [EVENT_TYPES.PQRS_RESPONDIDA]: (payload) => {
        const destinatario = payload.usuarioId ?? payload.peticionarioId ?? null;
        if (destinatario === null || destinatario === undefined) {
          logger.warn('PqrsRespondidaEvent sin destinatario; se omite la notificación', {
            pqrsUuid: payload.pqrsUuid,
          });
          return Promise.resolve(null);
        }
        return this.dispatcher.notifyUser({
          recipientId: destinatario,
          templateCode: 'pqrs.answered',
          variables: { tipo_pqrs: payload.tipoPqrs, respuesta: payload.respuesta },
          source: { service: 'pqrs-service', entity: 'pqrs', uuid: payload.pqrsUuid },
        });
      },
    };
  }

  /**
   * Procesa un evento con idempotencia por eventId.
   * @param {object} envelope - Envelope del evento.
   */
  async procesar(envelope) {
    const eventId = envelope?.eventId;
    const manejador = this.manejadores[envelope?.eventType];
    if (!manejador) {
      logger.warn('Evento sin manejador registrado', { eventType: envelope?.eventType });
      return { omitido: 'sin_manejador' };
    }

    const reclamado = eventId ? await this.idempotency.claim(eventId) : true;
    if (!reclamado) {
      return { omitido: 'duplicado' };
    }

    try {
      await manejador(envelope.payload || {}, envelope);
      if (eventId) {
        await this.idempotency.complete(eventId);
      }
      return { procesado: true };
    } catch (error) {
      if (eventId) {
        await this.idempotency.release(eventId);
      }
      throw error;
    }
  }

  start() {
    if (this.workers.length) {
      return this.workers;
    }
    Object.values(EVENT_TYPES).forEach((eventType) => {
      const queueName = EVENT_QUEUES[eventType];
      if (!queueName || !this.manejadores[eventType]) {
        return;
      }
      const worker = createWorker(
        queueName,
        async (job) => this.procesar(job.data),
        { concurrency: env.NOTIFICATION_WORKER_CONCURRENCY },
      );
      worker.on('failed', (job, err) => {
        logger.warn('Procesamiento de evento falló', {
          eventType: job?.data?.eventType,
          eventId: job?.data?.eventId,
          error: err.message,
        });
      });
      this.workers.push(worker);
    });
    return this.workers;
  }

  async close() {
    await Promise.all(this.workers.map((worker) => worker.close()));
    this.workers = [];
  }
}

module.exports = EventsConsumer;
