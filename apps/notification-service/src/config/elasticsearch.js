// eslint-disable-next-line import/no-extraneous-dependencies
const { createElasticsearchClient } = require('@uajs/shared-elasticsearch');

const { env } = require('./env');

const esClient = createElasticsearchClient({
  host: env.ELASTICSEARCH_HOST,
  port: String(env.ELASTICSEARCH_PORT),
  user: process.env.ELASTICSEARCH_USER || 'elastic',
  password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
  maxRetries: 3,
  requestTimeout: 10000,
});

/**
 * Garantiza que el índice de auditoría de entregas exista. No es bloqueante.
 */
const ensureNotificationsEventsIndex = async () => {
  try {
    const exists = await esClient.client.indices.exists({
      index: env.NOTIFICATION_EVENTS_INDEX,
    });
    const yaExiste = typeof exists === 'boolean' ? exists : exists?.body;
    if (!yaExiste) {
      await esClient.client.indices.create({
        index: env.NOTIFICATION_EVENTS_INDEX,
        body: {
          settings: { number_of_shards: 1, number_of_replicas: 1 },
          mappings: {
            dynamic: 'strict',
            properties: {
              '@timestamp': { type: 'date' },
              eventType: { type: 'keyword' },
              service: { type: 'keyword' },
              eventId: { type: 'keyword' },
              notificationUuid: { type: 'keyword' },
              recipientId: { type: 'keyword' },
              channel: { type: 'keyword' },
              status: { type: 'keyword' },
              reason: { type: 'text' },
            },
          },
        },
      });
    }
  } catch (error) {
    // Si el índice ya existe o hay un fallo transitorio, se reintenta en el próximo arranque.
  }
};

/**
 * Registra un evento de auditoría de entrega en Elasticsearch.
 * @param {Object} document - Campos del evento (ver mappings).
 */
const indexAuditEvent = async (document) => {
  await esClient.client.index({
    index: env.NOTIFICATION_EVENTS_INDEX,
    document: {
      '@timestamp': new Date().toISOString(),
      service: 'notification-service',
      ...document,
    },
  });
};

module.exports = { esClient, ensureNotificationsEventsIndex, indexAuditEvent };
