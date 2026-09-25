const { Client } = require('@elastic/elasticsearch');
const CircuitBreaker = require('opossum');
const { v4: uuidv4 } = require('uuid');

const USER_INDEX = 'uajs_users';
const LOG_INDEX = 'uajs_logs';
const EVENT_INDEX = 'uajs_events';
const RESOURCE_INDEX = 'uajs_resources';
const BOOKING_INDEX = 'uajs_bookings';
const CATALOG_INDEX = 'uajs_catalogs';
const UNIVERSITY_INDEX = 'uajs_university';
const REQUEST_INDEX = 'uajs_requests';
const NOTIFICATION_INDEX = 'uajs_notifications';
const PQRS_INDEX = 'uajs_pqrs';
const STORAGE_INDEX = 'uajs_storage';
const AUTH_INDEX = 'uajs_auth';
const GATEWAY_INDEX = 'uajs_gateway';

class ElasticsearchClient {
  constructor({
    host = 'elasticsearch',
    port = '9200',
    user = 'elastic',
    password = 'changeme',
    apiVersion = '8.12',
    maxRetries = 5,
    requestTimeout = 30000,
    circuitBreakerThreshold = 50,
    circuitBreakerResetTimeout = 30000,
  } = {}) {
    this.client = new Client({
      node: `http://${host}:${port}`,
      auth: { username: user, password },
      apiVersion,
      maxRetries,
      requestTimeout,
      sniffOnStart: process.env.ES_SNIFF === 'true',
    });

    this.breaker = new CircuitBreaker(
      async (method, params, opts) => this.client[method](params, opts),
      {
        timeout: requestTimeout,
        errorThresholdPercentage: circuitBreakerThreshold,
        resetTimeout: circuitBreakerResetTimeout,
      },
    );

    this.breaker.on('open', () => {
      console.warn('[ES CircuitBreaker] OPEN — circuit is tripped');
    });

    this.breaker.on('halfOpen', () => {
      console.info('[ES CircuitBreaker] HALF-OPEN — testing recovery');
    });

    this.breaker.on('close', () => {
      console.info('[ES CircuitBreaker] CLOSED — recovered');
    });

    const methods = [
      'search',
      'index',
      'get',
      'update',
      'delete',
      'bulk',
      'count',
      'exists',
      'info',
      'ping',
      'mget',
      'msearch',
      'refresh',
    ];

    for (const method of methods) {
      this[method] = async (params, opts = {}) => {
        const requestId = uuidv4();
        try {
          return await this.breaker.fire(method, params, {
            ...opts,
            id: requestId,
            ignore: [404],
          });
        } catch (error) {
          if (this.breaker.open) {
            return this.client[method](params, opts);
          }
          throw this._enhanceError(error, method, params, requestId);
        }
      };
    }
  }

  _enhanceError(error, method, params, requestId) {
    const err = new Error(error.message);
    err.name = error.name;
    err.statusCode = error.meta?.statusCode || error.statusCode;
    err.method = method;
    err.params = params;
    err.timestamp = new Date().toISOString();
    err.requestId = requestId || uuidv4();
    return err;
  }

  async ping() {
    try {
      await this.info();
      return { healthy: true, status: 'up' };
    } catch (error) {
      return { healthy: false, status: 'down', error: error.message };
    }
  }

  async getClusterHealth() {
    try {
      const health = await this.client.cluster.health();
      return health;
    } catch (error) {
      return { status: 'unknown', error: error.message };
    }
  }

  async createIndex(index, body) {
    const exists = await this.indices.exists({ index });
    if (!exists) {
      await this.client.indices.create({ index, body });
      return { created: true, index };
    }
    return { created: false, index };
  }

  getBreakerStats() {
    return {
      state: this.breaker.open ? 'OPEN' : this.breaker.halfOpen ? 'HALF-OPEN' : 'CLOSED',
      stats: this.breaker.stats,
    };
  }

  getClient() {
    return this.client;
  }

  close() {
    this.breaker.shutdown();
  }
}

const createElasticsearchClient = (config) => new ElasticsearchClient(config);

module.exports = {
  ElasticsearchClient,
  createElasticsearchClient,
  pingElasticsearch: async (client) => (await client.ping()).healthy,
  createIndex: async (client, indexName, mapping) => {
    const result = await client.createIndex(indexName, mapping);
    return result.created;
  },
  USER_INDEX,
  LOG_INDEX,
  EVENT_INDEX,
  RESOURCE_INDEX,
  BOOKING_INDEX,
  CATALOG_INDEX,
  UNIVERSITY_INDEX,
  REQUEST_INDEX,
  NOTIFICATION_INDEX,
  PQRS_INDEX,
  STORAGE_INDEX,
  AUTH_INDEX,
  GATEWAY_INDEX,
};
