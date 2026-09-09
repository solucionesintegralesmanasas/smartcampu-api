const os = require('node:os');

const { createMysqlPool, createRedisClient } = require('@uajs/database-client');
const { generateUuid } = require('@uajs/shared-utils');
const CircuitBreaker = require('opossum');

const { esClient } = require('../config/elasticsearch');
const logger = require('../config/logger');

const SERVICE_VERSION = process.env.SERVICE_VERSION || 'v2.1.4';
const HEALTH_CACHE_TTL_MS = 12000;
const DEPENDENCY_TIMEOUT_MS = 2000;

let mysqlPool = null;
let redisClient = null;

function getMysqlPool() {
  if (mysqlPool) return mysqlPool;
  mysqlPool = createMysqlPool({
    host: process.env.MYSQL_HOST || 'mysql',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'uajs_user',
    password: process.env.MYSQL_PASSWORD || 'uajs206**',
    database: process.env.MYSQL_DATABASE || 'uajs_smart_campus',
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
  });
  return mysqlPool;
}

function getRedisClient() {
  if (redisClient) return redisClient;
  redisClient = createRedisClient({
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    commandTimeout: DEPENDENCY_TIMEOUT_MS,
  });
  return redisClient;
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Timeout after ${timeoutMs}ms`);
      err.name = 'HealthTimeoutError';
      err.dependency = label;
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function buildBreaker(action, name) {
  const breaker = new CircuitBreaker(action, {
    timeout: DEPENDENCY_TIMEOUT_MS,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    volumeThreshold: 2,
  });
  return breaker;
}

function buildMysqlProbe() {
  const breaker = buildBreaker(async () => {
    const start = Date.now();
    await withTimeout(getMysqlPool().query('SELECT 1'), DEPENDENCY_TIMEOUT_MS, 'mysql');
    return { latencyMs: Date.now() - start };
  }, 'mysql-auth-ping');

  return async () => {
    const correlationId = generateUuid();
    try {
      const result = await breaker.fire();
      return { status: 'UP', latency_ms: result.latencyMs };
    } catch (error) {
      logger.error(
        JSON.stringify({
          level: 'error',
          service: 'api-gateway',
          component: 'health.middleware',
          dependency: 'auth_mysql',
          correlationId,
          message: 'MySQL dependency health check failed',
          error: error.message,
          circuitOpen: breaker.opened === true,
          timestamp: new Date().toISOString(),
        }),
      );
      return { status: 'DOWN', message: error.message, correlationId };
    }
  };
}

function buildRedisProbe() {
  const breaker = buildBreaker(async () => {
    const start = Date.now();
    const pong = await withTimeout(getRedisClient().ping(), DEPENDENCY_TIMEOUT_MS, 'redis');
    if (!pong) throw new Error('Redis ping returned falsy');
    return { latencyMs: Date.now() - start };
  }, 'redis-perimeter-ping');

  return async () => {
    const correlationId = generateUuid();
    try {
      const result = await breaker.fire();
      return { status: 'UP', latency_ms: result.latencyMs };
    } catch (error) {
      logger.warn(
        JSON.stringify({
          level: 'warn',
          service: 'api-gateway',
          component: 'health.middleware',
          dependency: 'redis_perimeter',
          correlationId,
          message: 'Redis dependency health check failed',
          error: error.message,
          circuitOpen: breaker.opened === true,
          timestamp: new Date().toISOString(),
        }),
      );
      return { status: 'DOWN', message: error.message, correlationId };
    }
  };
}

function buildElasticsearchProbe() {
  const breaker = buildBreaker(async () => {
    const start = Date.now();
    const health = await withTimeout(
      esClient.client.cluster.health({ timeout: '1s' }),
      DEPENDENCY_TIMEOUT_MS,
      'elasticsearch',
    );
    return { latencyMs: Date.now() - start, status: health.status };
  }, 'elasticsearch-ping');

  return async () => {
    const correlationId = generateUuid();
    try {
      const result = await breaker.fire();
      const clusterStatus = result.status;
      if (['green', 'yellow'].includes(clusterStatus)) {
        return { status: 'UP', latency_ms: result.latencyMs, cluster_status: clusterStatus };
      }
      return {
        status: 'DEGRADED',
        latency_ms: result.latencyMs,
        cluster_status: clusterStatus,
        message: 'Cluster status not green/yellow',
      };
    } catch (error) {
      const statusCode = error.meta?.statusCode || error.statusCode;
      const message = statusCode === 500 ? 'Response time is higher than expected' : error.message;
      logger.warn(
        JSON.stringify({
          level: 'warn',
          service: 'api-gateway',
          component: 'health.middleware',
          dependency: 'elasticsearch',
          correlationId,
          message: 'Elasticsearch dependency health check failed',
          error: error.message,
          statusCode,
          circuitOpen: breaker.opened === true,
          timestamp: new Date().toISOString(),
        }),
      );
      return { status: 'DEGRADED', message, correlationId };
    }
  };
}

function buildDiskProbe() {
  return async () => {
    try {
      const freeBytes = typeof os.freemem === 'function' ? os.freemem() : 50 * 1024 * 1024 * 1024;
      return { status: 'UP', free_bytes: freeBytes };
    } catch (error) {
      return { status: 'DOWN', message: error.message };
    }
  };
}

let lastSnapshot = null;
let lastSnapshotAt = 0;
let pollingTimer = null;
const processBootAt = Date.now();

const PROBES = {
  mysql_auth: buildMysqlProbe(),
  redis_perimeter: buildRedisProbe(),
  elasticsearch: buildElasticsearchProbe(),
  disk_space: buildDiskProbe(),
};

async function pollOnce() {
  const keys = Object.keys(PROBES);
  const settled = await Promise.allSettled(keys.map((k) => PROBES[k]()));
  const snapshot = {};
  keys.forEach((name, idx) => {
    const r = settled[idx];
    snapshot[name] = r.status === 'fulfilled'
      ? r.value
      : { status: 'DOWN', message: r.reason?.message || 'unknown' };
  });
  lastSnapshot = snapshot;
  lastSnapshotAt = Date.now();
  return snapshot;
}

function ensurePolling() {
  if (pollingTimer) return;
  if (!lastSnapshot) {
    pollOnce().catch(() => {});
  }
  pollingTimer = setInterval(() => {
    pollOnce().catch((err) => {
      logger.error(
        JSON.stringify({
          level: 'error',
          service: 'api-gateway',
          component: 'health.middleware',
          message: 'Background health polling failed',
          error: err.message,
          timestamp: new Date().toISOString(),
        }),
      );
    });
  }, HEALTH_CACHE_TTL_MS);
  if (typeof pollingTimer.unref === 'function') pollingTimer.unref();
}

function getCachedSnapshot() {
  if (lastSnapshot) return lastSnapshot;
  return Object.fromEntries(
    Object.keys(PROBES).map((k) => [k, { status: 'UNKNOWN', message: 'snapshot not ready' }]),
  );
}

function aggregateStatus(details) {
  const mysqlDown = details.mysql_auth?.status === 'DOWN';
  if (mysqlDown) return { status: 'DOWN', http: 503 };

  const nonCriticalFailing = ['redis_perimeter', 'elasticsearch'].some(
    (k) => details[k] && details[k].status === 'DOWN',
  );
  if (nonCriticalFailing) return { status: 'DEGRADED', http: 200 };

  const anyDegraded = Object.values(details).some((d) => d?.status === 'DEGRADED');
  if (anyDegraded) return { status: 'DEGRADED', http: 200 };

  return { status: 'UP', http: 200 };
}

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}, ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function buildHealthPayload() {
  const details = getCachedSnapshot();
  const agg = aggregateStatus(details);
  return {
    status: agg.status,
    version: SERVICE_VERSION,
    uptime: formatUptime(Date.now() - processBootAt),
    timestamp: new Date().toISOString(),
    details,
    httpStatus: agg.http,
  };
}

function livenessHandler(req, res) {
  res.status(200).json({
    status: 'UP',
    service: 'api-gateway',
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
}

async function readinessHandler(req, res) {
  try {
    ensurePolling();
    const needsPoll = !lastSnapshot || Date.now() - lastSnapshotAt > HEALTH_CACHE_TTL_MS;
    if (needsPoll) await pollOnce();
    const payload = buildHealthPayload();
    res.status(payload.httpStatus).json({
      status: payload.status,
      version: payload.version,
      uptime: payload.uptime,
      timestamp: payload.timestamp,
      details: payload.details,
    });
  } catch (error) {
    logger.error(
      JSON.stringify({
        level: 'error',
        service: 'api-gateway',
        component: 'health.middleware',
        correlationId: req.correlationId,
        message: 'Readiness handler failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    );
    res.status(503).json({
      status: 'DOWN',
      error: 'readiness_check_failed',
      correlationId: req.correlationId,
    });
  }
}

function prometheusMetricsHandler(req, res) {
  const snapshot = getCachedSnapshot();
  const lines = [];
  lines.push('# HELP api_gateway_up 1 if the api-gateway process is responsive');
  lines.push('# TYPE api_gateway_up gauge');
  lines.push('api_gateway_up 1');

  lines.push('# HELP api_gateway_dependency_up Dependency status (1=UP, 0=DOWN, 0.5=DEGRADED)');
  lines.push('# TYPE api_gateway_dependency_up gauge');
  Object.entries(snapshot).forEach(([name, info]) => {
    let value = 0;
    if (info?.status === 'UP') value = 1;
    else if (info?.status === 'DEGRADED') value = 0.5;
    lines.push(`api_gateway_dependency_up{dependency="${name}"} ${value}`);
    if (typeof info?.latency_ms === 'number') {
      lines.push(`api_gateway_dependency_latency_ms{dependency="${name}"} ${info.latency_ms}`);
    }
  });

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.status(200).send(`${lines.join('\n')}\n`);
}

function shutdown() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  try {
    if (mysqlPool) mysqlPool.close();
  } catch (_) {
    /* swallow */
  }
  try {
    if (redisClient) redisClient.close();
  } catch (_) {
    /* swallow */
  }
  mysqlPool = null;
  redisClient = null;
  lastSnapshot = null;
  lastSnapshotAt = 0;
  PROBES.mysql_auth = buildMysqlProbe();
  PROBES.redis_perimeter = buildRedisProbe();
  PROBES.elasticsearch = buildElasticsearchProbe();
}

module.exports = {
  livenessHandler,
  readinessHandler,
  prometheusMetricsHandler,
  buildHealthPayload,
  pollOnce,
  ensurePolling,
  shutdown,
  _internals: { aggregateStatus, getCachedSnapshot, PROBES },
};
