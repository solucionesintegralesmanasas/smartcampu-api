const domainTypes = require('./src/domain.types');
const eventTypes = require('./src/event.types');
const userTypes = require('./src/user.types');

const USER_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  STAFF: 'STAFF',
});

const RECORD_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  BLOCKED: 'BLOCKED',
  DELETED: 'DELETED',
});

module.exports = {
  USER_ROLES,
  RECORD_STATUS,

  // User
  USER_DTO_FIELDS: userTypes.USER_DTO_FIELDS,
  USER_ESTADOS: userTypes.USER_ESTADOS,

  // Domain
  DOMAIN_DTO_FIELDS: domainTypes.DOMAIN_DTO_FIELDS,

  // Events
  EVENT_TYPES: eventTypes.EVENT_TYPES,
  EVENT_QUEUES: eventTypes.EVENT_QUEUES,
  EVENT_REGISTRY: eventTypes.EVENT_REGISTRY,

  // Elasticsearch Types
  ...require('./src/elasticsearch.types'),
};
