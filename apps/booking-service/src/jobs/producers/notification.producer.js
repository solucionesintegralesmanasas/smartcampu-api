const { env } = require('../../config/env');
const { createQueue } = require('../../config/queues');

/**
 * Publica en la cola COMPARTIDA que escucha notification-service — nunca en
 * BOOKING_QUEUE, que ya tiene su propio consumidor de auditoría en este
 * mismo servicio (BullMQ reparte los jobs de una cola entre los workers que
 * la escuchan, no los duplica; dos consumidores en la misma cola compiten
 * por cada job en vez de recibirlo ambos).
 */
class NotificationProducer {
  constructor() {
    this.queue = createQueue(env.NOTIFICATION_QUEUE);
  }

  async notify(eventType, data) {
    // BullMQ reintenta la conexión a Redis indefinidamente cuando no puede
    // conectar: si se esperara sin límite, un Redis caído colgaría para
    // siempre la transición real que disparó esta notificación (que ya
    // ocurrió y no debe revertirse). Se acota la espera; si Redis no
    // responde a tiempo, el intento queda abandonado en segundo plano
    // (con su propio catch para no dejar un unhandled rejection) y la
    // petición HTTP sigue su curso normal.
    const addPromise = this.queue
      .add(
        'domain_event',
        { eventType, ...data, timestamp: new Date().toISOString() },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      )
      .catch(() => {});
    await Promise.race([
      addPromise,
      new Promise((resolve) => { setTimeout(resolve, 2000); }),
    ]);
  }
}

module.exports = NotificationProducer;
