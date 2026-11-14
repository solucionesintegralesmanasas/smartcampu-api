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
const createQueue = (name) => new Queue(name, { connection });

/**
 * Crea un trabajador de BullMQ.
 * @param {string} name - Nombre de la cola.
 * @param {Function} processor - Función procesadora.
 * @param {Object} [options] - Opciones del worker (ej. concurrency).
 * @returns {Worker} Instancia del trabajador.
 */
const createWorker = (name, processor, options = {}) => new Worker(name, processor, {
  connection,
  ...options,
});

module.exports = { createQueue, createWorker };
