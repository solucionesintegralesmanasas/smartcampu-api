const {
  ElasticsearchClient,
  createElasticsearchClient,
  pingElasticsearch,
  createIndex,
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
} = require('./src/client');

const mappings = {
  user: require('./src/mappings/user.mapping'),
  event: require('./src/mappings/event.mapping'),
  resource: require('./src/mappings/resource.mapping'),
  booking: require('./src/mappings/booking.mapping'),
  catalog: require('./src/mappings/catalog.mapping'),
  university: require('./src/mappings/university.mapping'),
  request: require('./src/mappings/request.mapping'),
  notification: require('./src/mappings/notification.mapping'),
  pqrs: require('./src/mappings/pqrs.mapping'),
  storage: require('./src/mappings/storage.mapping'),
  auth: require('./src/mappings/auth.mapping'),
  gateway: require('./src/mappings/gateway.mapping'),
};

const queries = {
  logs: require('./src/queries/logs.queries'),
  user: require('./src/queries/user.queries'),
  event: require('./src/queries/event.queries'),
  resource: require('./src/queries/resource.queries'),
  booking: require('./src/queries/booking.queries'),
};

const utils = {
  ElasticsearchLogger: require('./src/utils/logger'),
  BulkProcessor: require('./src/utils/bulkHelper'),
  indexHelper: require('./src/utils/indexHelper'),
  ...require('./src/utils/monitoring'),
};

const ilm = require('./src/ilm');
const templates = require('./src/templates/searchTemplates');

module.exports = {
  ElasticsearchClient,
  createElasticsearchClient,
  createResilientElasticsearchClient: createElasticsearchClient,
  pingElasticsearch,
  createIndex,
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
  mappings,
  queries,
  utils,
  ilm,
  templates,
};
