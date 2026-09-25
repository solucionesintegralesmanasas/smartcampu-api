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

const ensureCatalogIndex = async () => {
  try {
    const indices = [
      {
        name: env.CATALOG_INDEX,
        body: {
          settings: { number_of_shards: 1, number_of_replicas: 0 },
          mappings: {
            properties: {
              type: { type: 'keyword' },
              id: { type: 'integer' },
              name: { type: 'text', analyzer: 'spanish' },
            },
          },
        },
      },
      {
        name: 'departments',
        body: {
          mappings: {
            properties: {
              id: { type: 'integer' },
              uuid: { type: 'keyword' },
              name: { type: 'text', analyzer: 'spanish', fields: { keyword: { type: 'keyword' } } },
              daneCode: { type: 'keyword' },
              countryId: { type: 'integer' },
              active: { type: 'boolean' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      },
      {
        name: 'cities',
        body: {
          mappings: {
            properties: {
              id: { type: 'integer' },
              uuid: { type: 'keyword' },
              name: { type: 'text', analyzer: 'spanish', fields: { keyword: { type: 'keyword' } } },
              daneCode: { type: 'keyword' },
              stateId: { type: 'integer' },
              active: { type: 'boolean' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      },
      {
        name: 'campuses',
        body: {
          mappings: {
            properties: {
              id: { type: 'integer' },
              uuid: { type: 'keyword' },
              name: { type: 'text', analyzer: 'spanish', fields: { keyword: { type: 'keyword' } } },
              address: { type: 'text' },
              phone: { type: 'keyword' },
              cityId: { type: 'integer' },
              active: { type: 'boolean' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      },
      {
        name: 'document-types',
        body: {
          mappings: {
            properties: {
              id: { type: 'integer' },
              uuid: { type: 'keyword' },
              name: { type: 'text', analyzer: 'spanish', fields: { keyword: { type: 'keyword' } } },
              code: { type: 'keyword' },
              requiresCheckDigit: { type: 'boolean' },
              active: { type: 'boolean' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      },
    ];

    await Promise.all(
      indices.map(async (idx) => {
        const exists = await esClient.client.indices.exists({ index: idx.name });
        const isPresent = typeof exists === 'boolean' ? exists : exists.body;
        if (!isPresent) {
          await esClient.client.indices.create({ index: idx.name, body: idx.body });
        }
      }),
    );
  } catch (error) {
    // La creación de índices se realiza de forma no bloqueante
  }
};

module.exports = { esClient, ensureCatalogIndex };
