const { createQueue } = require('../../config/queues');

class CatalogProducer {
  constructor() {
    this.queue = createQueue('catalog_events');
  }

  async addCatalogEvent(eventType, data) {
    await this.queue.add(
      'log_catalog_event',
      {
        eventType,
        ...data,
        timestamp: new Date().toISOString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }
}

module.exports = CatalogProducer;
