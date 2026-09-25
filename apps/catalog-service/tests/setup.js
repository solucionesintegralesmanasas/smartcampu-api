jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3003,
    MYSQL_HOST: 'localhost',
    MYSQL_PORT: 3306,
    MYSQL_USER: 'test_user',
    MYSQL_PASSWORD: 'test_password',
    MYSQL_DATABASE: 'uajs_catalog',
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    ELASTICSEARCH_HOST: 'localhost',
    ELASTICSEARCH_PORT: 9200,
    CATALOG_QUEUE: 'test_catalog',
    CATALOG_INDEX: 'test_catalogs',
    CATALOG_CACHE_TTL: 3600,
  },
}));

jest.mock('../src/config/elasticsearch', () => ({
  esClient: {
    index: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    search: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
    client: {
      indices: {
        exists: jest.fn().mockResolvedValue({ body: true }),
        create: jest.fn().mockResolvedValue({}),
      },
    },
  },
  ensureCatalogIndex: jest.fn().mockResolvedValue(true),
}));
