const logger = require('../../config/logger');
const {
  CANALES,
  DESTINATARIO_DIFUSION,
  ESTADOS,
  MOTIVOS,
  categoriaDePlantilla,
  destinatarioDe,
} = require('../constants/notification.constants');
const { renderTemplate } = require('../helpers/template.helper');
const { getDefaultTemplate } = require('../templates/default-templates');

const ESTADOS_FINALES = [ESTADOS.DELIVERED, ESTADOS.READ];

/**
 * Genera notificaciones a partir de plantillas, aplica preferencias del usuario
 * y coordina la entrega por canal (correo, push) con reintentos.
 */
class NotificationDispatcher {
  /**
   * @param {Object} deps
   * @param {Object} deps.notificationsRepository
   * @param {Object} deps.templatesRepository
   * @param {Object} deps.preferencesRepository
   * @param {Object} deps.pushRepository
   * @param {{ addDelivery: Function }} deps.deliveryProducer
   * @param {{ publish: Function }} deps.generatedProducer
   * @param {Object<string, { send: Function }>} deps.channelAdapters - Adaptadores por canal (email, push).
   * @param {Function} [deps.audit] - Registra auditoría de entregas (no bloqueante).
   */
  constructor({
    notificationsRepository,
    templatesRepository,
    preferencesRepository,
    pushRepository,
    deliveryProducer,
    generatedProducer,
    channelAdapters,
    audit = async () => {},
  }) {
    this.notificationsRepository = notificationsRepository;
    this.templatesRepository = templatesRepository;
    this.preferencesRepository = preferencesRepository;
    this.pushRepository = pushRepository;
    this.deliveryProducer = deliveryProducer;
    this.generatedProducer = generatedProducer;
    this.channelAdapters = channelAdapters;
    this.audit = audit;
  }

  /**
   * Plantilla in_app para un código: la guardada en BD (si está activa) o la de por defecto.
   * @returns {Promise<Object|null>}
   */
  async resolveTemplate(code) {
    const guardada = await this.templatesRepository.findOne(code, CANALES.IN_APP);
    if (guardada) return guardada.isActive ? guardada : null;
    return getDefaultTemplate(code);
  }

  render(plantilla, variables) {
    return {
      asunto: renderTemplate(plantilla.subject, variables),
      cuerpo: renderTemplate(plantilla.bodyText, variables) ?? '',
    };
  }

  /**
   * Notifica a un usuario: crea la notificación in_app y, según preferencias,
   * encola la entrega por correo y por push.
   * @param {Object} params
   * @param {number|string} params.recipientId - Id del usuario destinatario.
   * @param {string} params.templateCode - Código de plantilla, ej. 'request.created'.
   * @param {Object} [params.variables] - Variables de la plantilla.
   * @param {{service?: string, entity?: string, uuid?: string}} [params.source] - Origen del evento.
   * @param {string|null} [params.eventId] - eventId del envelope.
   * @returns {Promise<Object|null>} Notificación in_app creada, o null si no hay plantilla.
   */
  async notifyUser({
    recipientId, templateCode, variables = {}, source = {}, eventId = null,
  }) {
    const plantilla = await this.resolveTemplate(templateCode);
    if (!plantilla) {
      logger.warn('Plantilla in_app no disponible; no se genera notificación', { templateCode });
      return null;
    }

    const categoria = categoriaDePlantilla(templateCode);
    const { asunto, cuerpo } = this.render(plantilla, variables);
    const base = {
      templateId: plantilla.id ?? null,
      recipientUuid: destinatarioDe(recipientId),
      subject: asunto,
      body: cuerpo,
      sourceService: source.service ?? null,
      sourceEntity: source.entity ?? null,
      sourceUuid: source.uuid ?? null,
      metadata: { eventId, categoria, plantilla: templateCode },
    };

    const inApp = await this.notificationsRepository.create({
      ...base,
      channel: CANALES.IN_APP,
      status: ESTADOS.DELIVERED,
      deliveredAt: new Date(),
    });
    await this.publishGenerated(inApp, categoria, recipientId);

    await this.enqueueChannel(CANALES.EMAIL, base, categoria);
    await this.enqueueChannel(CANALES.PUSH, base, categoria);

    return inApp;
  }

  /**
   * Crea una difusión a la comunidad (sin iterar usuarios). Se guarda con el destinatario centinela.
   * @returns {Promise<Object|null>}
   */
  async notifyBroadcast({
    templateCode, variables = {}, source = {}, eventId = null,
  }) {
    const plantilla = await this.resolveTemplate(templateCode);
    if (!plantilla) {
      logger.warn('Plantilla in_app no disponible; no se genera difusión', { templateCode });
      return null;
    }

    const categoria = categoriaDePlantilla(templateCode);
    const { asunto, cuerpo } = this.render(plantilla, variables);
    const difusion = await this.notificationsRepository.create({
      templateId: plantilla.id ?? null,
      recipientUuid: DESTINATARIO_DIFUSION,
      channel: CANALES.IN_APP,
      subject: asunto,
      body: cuerpo,
      sourceService: source.service ?? null,
      sourceEntity: source.entity ?? null,
      sourceUuid: source.uuid ?? null,
      status: ESTADOS.DELIVERED,
      deliveredAt: new Date(),
      metadata: {
        eventId, categoria, plantilla: templateCode, difusion: true,
      },
    });
    await this.publishGenerated(difusion, categoria, null);
    return difusion;
  }

  /**
   * Difusión manual creada por un ADMIN o STAFF.
   * @returns {Promise<Object>}
   */
  async createManualBroadcast({ titulo, mensaje, creadoPor }) {
    const difusion = await this.notificationsRepository.create({
      templateId: null,
      recipientUuid: DESTINATARIO_DIFUSION,
      channel: CANALES.IN_APP,
      subject: titulo,
      body: mensaje,
      sourceService: 'notification-service',
      sourceEntity: 'difusion',
      sourceUuid: null,
      status: ESTADOS.DELIVERED,
      deliveredAt: new Date(),
      metadata: { difusion: true, creadoPor: destinatarioDe(creadoPor) },
    });
    await this.publishGenerated(difusion, 'difusion', null);
    return difusion;
  }

  /**
   * Crea el registro del canal y lo encola. Si las preferencias lo desactivan,
   * guarda el registro como no enviado (fallido con motivo) sin encolar.
   */
  async enqueueChannel(canal, base, categoria) {
    const habilitado = await this.preferencesRepository.isEnabled(
      base.recipientUuid,
      categoria,
      canal,
    );

    if (!habilitado) {
      await this.notificationsRepository.create({
        ...base,
        channel: canal,
        status: ESTADOS.FAILED,
        failedAt: new Date(),
        failureReason: MOTIVOS.CANAL_DESACTIVADO,
        retryCount: 0,
      });
      return;
    }

    const fila = await this.notificationsRepository.create({
      ...base,
      channel: canal,
      status: ESTADOS.QUEUED,
    });

    try {
      await this.deliveryProducer.addDelivery(fila.uuid);
    } catch (error) {
      logger.error('No se pudo encolar la entrega de notificación', {
        notificationUuid: fila.uuid,
        canal,
        error: error.message,
      });
      await this.notificationsRepository.updateStatus(fila.id, {
        status: ESTADOS.FAILED,
        failedAt: new Date(),
        failureReason: MOTIVOS.NO_ENCOLADO,
      });
    }
  }

  /**
   * Ejecuta la entrega de un registro de correo o push. Lanza error si el adaptador falla,
   * para que BullMQ reintente con backoff.
   * @param {string} notificationUuid
   * @param {number} [intentosPrevios=0] - attemptsMade del job.
   */
  async deliver(notificationUuid, intentosPrevios = 0) {
    const notificacion = await this.notificationsRepository.findByUuid(notificationUuid);
    if (!notificacion) {
      logger.warn('Notificación no encontrada para entrega', { notificationUuid });
      return { omitida: 'no_encontrada' };
    }
    if (ESTADOS_FINALES.includes(notificacion.status)) {
      return { omitida: 'ya_entregada' };
    }
    if (notificacion.channel === CANALES.IN_APP) {
      return { omitida: 'no_aplica' };
    }

    await this.notificationsRepository.updateStatus(notificacion.id, {
      status: ESTADOS.SENDING,
      sentAt: new Date(),
      retryCount: intentosPrevios,
    });

    if (notificacion.channel === CANALES.EMAIL && !notificacion.recipientEmail) {
      await this.marcarFallida(notificacion, MOTIVOS.SIN_CORREO);
      return { omitida: 'sin_correo' };
    }

    let suscripciones = [];
    if (notificacion.channel === CANALES.PUSH) {
      suscripciones = await this.pushRepository.findActiveByUser(notificacion.recipientUuid);
      if (!suscripciones.length) {
        await this.marcarFallida(notificacion, MOTIVOS.SIN_SUSCRIPCION);
        return { omitida: 'sin_suscripcion' };
      }
    }

    const adaptador = this.channelAdapters[notificacion.channel];
    if (!adaptador) {
      throw new Error(`No hay adaptador para el canal ${notificacion.channel}`);
    }

    const { proveedorId } = await adaptador.send({
      notificationUuid,
      destinatario: notificacion.recipientEmail || notificacion.recipientUuid,
      asunto: notificacion.subject,
      cuerpo: notificacion.body,
      suscripciones,
    });

    await this.notificationsRepository.updateStatus(notificacion.id, {
      status: ESTADOS.DELIVERED,
      deliveredAt: new Date(),
      failureReason: null,
    });
    await this.registrarAuditoria({
      eventType: 'notification.delivered',
      notificationUuid,
      recipientId: notificacion.recipientUuid,
      channel: notificacion.channel,
      status: ESTADOS.DELIVERED,
    });

    return { entregada: true, proveedorId };
  }

  /**
   * Marca como fallida una entrega cuyos reintentos se agotaron.
   * @param {string} notificationUuid
   * @param {string} motivo
   */
  async markFailed(notificationUuid, motivo) {
    const notificacion = await this.notificationsRepository.findByUuid(notificationUuid);
    if (!notificacion || ESTADOS_FINALES.includes(notificacion.status)) return;
    await this.marcarFallida(notificacion, motivo);
  }

  async marcarFallida(notificacion, motivo) {
    const texto = String(motivo).slice(0, 500);
    await this.notificationsRepository.updateStatus(notificacion.id, {
      status: ESTADOS.FAILED,
      failedAt: new Date(),
      failureReason: texto,
    });
    await this.registrarAuditoria({
      eventType: 'notification.failed',
      notificationUuid: notificacion.uuid,
      recipientId: notificacion.recipientUuid,
      channel: notificacion.channel,
      status: ESTADOS.FAILED,
      reason: texto,
    });
  }

  async publishGenerated(notificacion, tipoNotificacion, usuarioId) {
    try {
      await this.generatedProducer.publish({
        notificacionUuid: notificacion.uuid,
        usuarioId: usuarioId ?? null,
        tipoNotificacion,
        titulo: notificacion.subject ?? '',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn('No se pudo publicar NotificacionGeneradaEvent', {
        notificacionUuid: notificacion.uuid,
        error: error.message,
      });
    }
  }

  async registrarAuditoria(evento) {
    try {
      await this.audit({
        ...evento,
        recipientId: evento.recipientId,
      });
    } catch (error) {
      logger.warn('No se pudo registrar la auditoría de entrega', { error: error.message });
    }
  }
}

module.exports = NotificationDispatcher;
