const { indexAuditEvent } = require('../config/elasticsearch');
const { env } = require('../config/env');
const NotificacionesRepository = require('../modules/notificaciones/notificaciones.repository');
const PlantillasRepository = require('../modules/plantillas/plantillas.repository');
const PreferenciasRepository = require('../modules/preferencias/preferencias.repository');
const SuscripcionesRepository = require('../modules/suscripciones/suscripciones.repository');
const DeliveryProducer = require('../jobs/producers/delivery.producer');
const GeneratedProducer = require('../jobs/producers/generated.producer');
const { createChannelAdapters } = require('./channels');
const NotificationDispatcher = require('./services/notification-dispatcher.service');

let dispatcher = null;

/**
 * Construye (una sola vez) el dispatcher de notificaciones con sus dependencias.
 * @returns {NotificationDispatcher}
 */
const buildDispatcher = () => {
  if (!dispatcher) {
    dispatcher = new NotificationDispatcher({
      notificationsRepository: new NotificacionesRepository(),
      templatesRepository: new PlantillasRepository(),
      preferencesRepository: new PreferenciasRepository(),
      pushRepository: new SuscripcionesRepository(),
      deliveryProducer: new DeliveryProducer(),
      generatedProducer: new GeneratedProducer(),
      channelAdapters: createChannelAdapters(env.NOTIFICATION_CHANNEL_DRIVER),
      audit: indexAuditEvent,
    });
  }
  return dispatcher;
};

module.exports = { buildDispatcher };
