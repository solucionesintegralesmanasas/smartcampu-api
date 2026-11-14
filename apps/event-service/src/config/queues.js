const { Queue, Worker } = require('bullmq');

const { env } = require('./env');

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

const colasCreadas = new Set();

/**
 * Crea una cola de BullMQ y la registra para cerrarla en el apagado ordenado.
 * @param {string} name - Nombre de la cola.
 * @returns {Queue} Instancia de la cola.
 */
const createQueue = (name) => {
  const queue = new Queue(name, { connection });
  colasCreadas.add(queue);
  return queue;
};

/**
 * Crea un trabajador de BullMQ.
 * @param {string} name - Nombre de la cola.
 * @param {Function} processor - Función procesadora.
 * @returns {Worker} Instancia del trabajador.
 */
const createWorker = (name, processor) => new Worker(name, processor, { connection });

/**
 * Cierra todas las colas creadas por este servicio.
 */
const closeQueues = async () => {
  await Promise.all([...colasCreadas].map((queue) => queue.close()));
  colasCreadas.clear();
};

module.exports = { createQueue, createWorker, closeQueues };
