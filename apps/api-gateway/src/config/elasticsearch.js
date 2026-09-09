const { createElasticsearchClient } = require('@uajs/shared-elasticsearch');

const esClient = createElasticsearchClient({
  host: process.env.ELASTICSEARCH_HOST || 'elasticsearch',
  port: process.env.ELASTICSEARCH_PORT || '9200',
  user: process.env.ELASTICSEARCH_USER || 'elastic',
  password: process.env.ELASTICSEARCH_PASSWORD || 'changeme',
});

module.exports = { esClient };
