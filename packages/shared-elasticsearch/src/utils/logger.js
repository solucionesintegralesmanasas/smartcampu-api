const { v4: uuidv4 } = require('uuid');

class ElasticsearchLogger {
  constructor(
    client,
    {
      serviceName = 'unknown',
      indexPrefix = 'uajs_logs',
      flushInterval = 5000,
      batchSize = 500,
      maxQueueSize = 10000,
      enableConsoleFallback = true,
    } = {},
  ) {
    this.client = client;
    this.serviceName = serviceName;
    this.indexPrefix = indexPrefix;
    this.flushInterval = flushInterval;
    this.batchSize = batchSize;
    this.maxQueueSize = maxQueueSize;
    this.enableConsoleFallback = enableConsoleFallback;
    this.queue = [];
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      dropped: 0,
    };
    this.flushTimeout = null;
    this._startFlusher();
  }

  _startFlusher() {
    this.flushTimeout = setInterval(() => {
      if (this.queue.length > 0) this.flush();
    }, this.flushInterval);
  }

  stopFlusher() {
    if (this.flushTimeout) clearInterval(this.flushTimeout);
    this.flush();
  }

  _addToQueue(entry) {
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      this.stats.dropped++;
    }
    this.queue.push(entry);
    this.stats.total++;
  }

  async flush() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.batchSize);
    const bulkBody = batch.flatMap((log) => [
      { index: { _index: `${this.indexPrefix}-${log['@timestamp'].split('T')[0]}` } },
      log,
    ]);
    try {
      const response = await this.client.bulk({ body: bulkBody, refresh: false });
      if (response.errors) {
        const failed = response.items.filter((i) => i.index?.status >= 400);
        this.stats.failed += failed.length;
        this.stats.success += batch.length - failed.length;
      } else {
        this.stats.success += batch.length;
      }
    } catch (error) {
      this.stats.failed += batch.length;
      if (this.enableConsoleFallback) {
        batch.forEach((log) => console.error(`[FALLBACK] ${log.level}: ${log.message}`));
      }
    }
  }

  log({
    level = 'info',
    message,
    correlationId = uuidv4(),
    requestId,
    userId,
    metadata = {},
    timestamp = new Date().toISOString(),
  } = {}) {
    const entry = {
      '@timestamp': timestamp,
      service: this.serviceName,
      level,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      correlationId,
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...metadata,
    };
    this._addToQueue(entry);
    if (this.queue.length >= this.batchSize) this.flush();
    return correlationId;
  }

  error(error, {
    correlationId, requestId, userId, metadata = {},
  } = {}) {
    return this.log({
      level: 'error',
      message: error.message,
      correlationId,
      requestId,
      userId,
      metadata: {
        ...metadata,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: error.code,
          statusCode: error.statusCode,
        },
      },
    });
  }

  warn(message, context = {}) {
    return this.log({ level: 'warn', message, ...context });
  }

  info(message, context = {}) {
    return this.log({ level: 'info', message, ...context });
  }

  debug(message, context = {}) {
    return this.log({ level: 'debug', message, ...context });
  }

  http({
    method, path, statusCode, duration, requestId, userId, correlationId, ip, userAgent,
  }) {
    return this.log({
      level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
      message: `${method} ${path} ${statusCode}`,
      correlationId,
      requestId,
      userId,
      metadata: {
        http: {
          method,
          path,
          statusCode,
          duration,
          ip,
          userAgent,
        },
      },
    });
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = ElasticsearchLogger;
