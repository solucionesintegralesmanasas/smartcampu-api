const { Queue, Worker } = require('bullmq');

const { env } = require('./env');

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

const createQueue = (name) => new Queue(name, { connection });

const createWorker = (name, processor) => new Worker(name, processor, { connection });

module.exports = { createQueue, createWorker };
