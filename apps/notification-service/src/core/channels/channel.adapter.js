/**
 * Contrato de un adaptador de canal de entrega (correo o push).
 *
 * Punto de extensión: para conectar un proveedor real (SMTP/SES para correo, Web Push/FCM para push)
 * crea una clase que extienda ChannelAdapter, implemente `send` y regístrala en
 * `src/core/channels/index.js`. Un error lanzado en `send` provoca reintento con backoff.
 */
class ChannelAdapter {
  /**
   * @param {string} canal - Canal que atiende el adaptador ('email' o 'push').
   */
  constructor(canal) {
    this.canal = canal;
  }

  /**
   * Entrega un mensaje por el canal.
   * @param {Object} mensaje
   * @param {string} mensaje.notificationUuid - Identificador de la notificación.
   * @param {string} mensaje.destinatario - Correo o identificador del destinatario.
   * @param {string|null} mensaje.asunto - Asunto renderizado.
   * @param {string} mensaje.cuerpo - Cuerpo renderizado.
   * @param {Array<{endpoint: string, authKey: string, p256dhKey: string}>} mensaje.suscripciones - Suscripciones push activas (sólo canal push).
   * @returns {Promise<{ proveedorId?: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async send(mensaje) {
    throw new Error(`El adaptador de canal ${this.canal} no implementa send()`);
  }
}

module.exports = ChannelAdapter;
