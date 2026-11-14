const { Queue } = require('bullmq');

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

module.exports = { createQueue };
