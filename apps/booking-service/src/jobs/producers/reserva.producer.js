const { EVENT_QUEUES, EVENT_TYPES, createEventEnvelope } = require('@uajs/shared-types');

const { createQueue } = require('../../config/queues');

const SOURCE = 'booking-service';

/**
 * Productor de eventos de dominio de reservas sobre colas BullMQ.
 * Las colas se crean de forma perezosa, la primera vez que se publica.
 */
class ReservaProducer {
  constructor() {
    this.queues = new Map();
  }

  getQueue(nombreCola) {
    if (!this.queues.has(nombreCola)) {
      this.queues.set(nombreCola, createQueue(nombreCola));
    }
    return this.queues.get(nombreCola);
  }

  /**
   * Publica el evento ReservaConfirmadaEvent envuelto en el envelope estándar.
   * @param {object} payload - reservaUuid, recursoId, usuarioId, fechaReserva, horaInicio, horaFin, timestamp.
   * @returns {Promise<object>} Envelope publicado.
   */
  async publicarReservaConfirmada(payload) {
    const eventType = EVENT_TYPES.RESERVA_CONFIRMADA;
    const evento = createEventEnvelope({ eventType, source: SOURCE, payload });

    await this.getQueue(EVENT_QUEUES[eventType]).add(eventType, evento, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    return evento;
  }

  async close() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }
}

let instancia = null;

const getReservaProducer = () => {
  if (!instancia) {
    instancia = new ReservaProducer();
  }
  return instancia;
};

module.exports = { ReservaProducer, getReservaProducer };
