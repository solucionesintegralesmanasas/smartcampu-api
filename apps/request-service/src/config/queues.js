const { Queue, Worker } = require('bullmq');

const { env } = require('./env');

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

const createQueue = (name) => {
  const queue = new Queue(name, { connection });
  if (typeof queue.on === 'function') {
    queue.on('error', () => {});
  }
  return queue;
};

const createWorker = (name, processor) => {
  const worker = new Worker(name, processor, { connection });
  if (typeof worker.on === 'function') {
    worker.on('error', () => {});
  }
  return worker;
};

module.exports = { createQueue, createWorker };
