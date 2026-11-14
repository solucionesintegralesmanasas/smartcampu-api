const logger = require('../../config/logger');

const ChannelAdapter = require('./channel.adapter');

/**
 * Adaptador de implementación por log: no envía nada real, sólo registra la entrega.
 * Sirve para desarrollo y pruebas sin depender de proveedores externos.
 */
class LogChannelAdapter extends ChannelAdapter {
  async send(mensaje) {
    logger.info(`[${this.canal}] entrega simulada por log`, {
      notificationUuid: mensaje.notificationUuid,
      destinatario: mensaje.destinatario,
      asunto: mensaje.asunto,
      suscripciones: mensaje.suscripciones ? mensaje.suscripciones.length : 0,
    });
    return { proveedorId: `log-${mensaje.notificationUuid}` };
  }
}

module.exports = LogChannelAdapter;
