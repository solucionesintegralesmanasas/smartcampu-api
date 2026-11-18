const {
  createMysqlPool,
  MySQLPool,
  pingPool,
  closePool,
  MysqlConnectionError,
  MysqlPoolExhaustedError,
  resolveMysqlSsl,
} = require('./src/mysql');
const {
  createRedisClient,
  RedisClient,
  pingRedis,
  closeRedis,
  RedisConnectionError,
} = require('./src/redis');

module.exports = {
  createMysqlPool,
  MySQLPool,
  pingPool,
  closePool,
  MysqlConnectionError,
  MysqlPoolExhaustedError,
  resolveMysqlSsl,
  createRedisClient,
  RedisClient,
  pingRedis,
  closeRedis,
  RedisConnectionError,
};
