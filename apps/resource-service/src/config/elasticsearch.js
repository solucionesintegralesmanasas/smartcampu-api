const { createElasticsearchClient, mappings, RESOURCE_INDEX } = require('@uajs/shared-elasticsearch');

const { env } = require('./env');

const esClient = createElasticsearchClient({
  host: env.ELASTICSEARCH_HOST,
  port: String(env.ELASTICSEARCH_PORT),
  user: env.ELASTICSEARCH_USER,
  password: env.ELASTICSEARCH_PASSWORD,
  maxRetries: 3,
  requestTimeout: 10000,
});

/**
 * Crea el índice de recursos con su mapping si todavía no existe.
 * No usa el helper `createIndex` del paquete compartido porque depende de
 * `this.indices`, que no existe en el wrapper de cliente.
 */
const ensureResourceIndex = async () => {
  const exists = await esClient.client.indices.exists({ index: RESOURCE_INDEX });
  const found = typeof exists === 'boolean' ? exists : exists.body;
  if (!found) {
    await esClient.client.indices.create({ index: RESOURCE_INDEX, ...mappings.resource });
  }
};

module.exports = { esClient, ensureResourceIndex };
