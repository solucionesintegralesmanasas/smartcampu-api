class BulkProcessor {
  constructor(
    client,
    {
      batchSize = 1000,
      flushInterval = 5000,
      maxRetries = 3,
      concurrentBatches = 2,
      onProgress,
      onError,
      onComplete,
    } = {},
  ) {
    this.client = client;
    this.batchSize = batchSize;
    this.flushInterval = flushInterval;
    this.maxRetries = maxRetries;
    this.concurrentBatches = Math.min(concurrentBatches, 5);
    this.onProgress = onProgress;
    this.onError = onError;
    this.onComplete = onComplete;
    this.queue = [];
    this.processing = 0;
    this.stats = {
      total: 0,
      processed: 0,
      failed: 0,
      retries: 0,
      startTime: null,
      endTime: null,
    };
    this.flushTimeout = null;
    this._startFlusher();
  }

  _startFlusher() {
    this.flushTimeout = setInterval(() => {
      if (this.queue.length > 0 && this.processing < this.concurrentBatches) {
        this.processBatch();
      }
    }, this.flushInterval);
  }

  add(index, id, document) {
    this.queue.push({ index, id, document });
    this.stats.total++;
    if (this.queue.length >= this.batchSize) this.processBatch();
  }

  addMany(documents, getIndex, getId) {
    documents.forEach((doc) => {
      this.queue.push({ index: getIndex(doc), id: getId(doc), document: doc });
      this.stats.total++;
    });
    if (this.queue.length >= this.batchSize) this.processBatch();
  }

  async processBatch() {
    if (this.queue.length === 0 || this.processing >= this.concurrentBatches) return;
    this.processing++;
    const batch = this.queue.splice(0, this.batchSize);
    const bulkBody = batch.flatMap(({ index, id, document }) => [
      { index: { _index: index, _id: id } },
      document,
    ]);

    let retryCount = 0;
    while (retryCount <= this.maxRetries) {
      try {
        const response = await this.client.bulk({ body: bulkBody, refresh: false });
        if (response.errors) {
          const failed = response.items.filter((i) => i.index?.status >= 400);
          this.stats.failed += failed.length;
          this.stats.processed += batch.length - failed.length;
          if (retryCount < this.maxRetries) {
            const failedIndices = failed.map((f) => batch.findIndex((b) => b.id === f.index._id));
            const failedDocs = failedIndices.map((idx) => batch[idx]).filter(Boolean);
            this.queue.unshift(...failedDocs);
            this.stats.retries += failed.length;
            retryCount++;
            continue;
          }
        } else {
          this.stats.processed += batch.length;
        }
        break;
      } catch (error) {
        retryCount++;
        this.stats.retries += batch.length;
        if (retryCount > this.maxRetries) {
          this.stats.failed += batch.length;
          if (this.onError) this.onError(error, batch);
        }
        await new Promise((r) => {
          setTimeout(r, 2 ** retryCount * 1000);
        });
      }
    }
    this.processing--;
    if (this.queue.length > 0) this.processBatch();
  }

  async waitForCompletion() {
    while (this.queue.length > 0 || this.processing > 0) {
      await new Promise((r) => {
        setTimeout(r, 100);
      });
    }
    return this.getStats();
  }

  getStats() {
    const s = { ...this.stats };
    if (s.startTime && s.endTime) {
      s.duration = s.endTime - s.startTime;
      s.opsPerSecond = s.processed / (s.duration / 1000);
    }
    return s;
  }

  stop() {
    if (this.flushTimeout) clearInterval(this.flushTimeout);
    return this.waitForCompletion();
  }
}

module.exports = BulkProcessor;
