const { Queue, Worker } = require('bullmq');

const { env } = require('./env');

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

/**
 * Crea una cola de BullMQ.
 * @param {string} name - Nombre de la cola.
 * @returns {Queue} Instancia de la cola.
 */
const createQueue = (name) => {
  const queue = new Queue(name, { connection });
  if (typeof queue.on === 'function') {
    queue.on('error', () => {});
  }
  return queue;
};

/**
 * Crea un trabajador de BullMQ.
 * @param {string} name - Nombre de la cola.
 * @param {Function} processor - Función procesadora.
 * @returns {Worker} Instancia del trabajador.
 */
const createWorker = (name, processor) => {
  const worker = new Worker(name, processor, { connection });
  if (typeof worker.on === 'function') {
    worker.on('error', () => {});
  }
  return worker;
};

module.exports = { createQueue, createWorker };
