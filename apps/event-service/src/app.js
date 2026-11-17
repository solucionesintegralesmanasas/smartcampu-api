const express = require('express');

const expressLoader = require('./core/loaders/express.loader');
const setupSwagger = require('./docs/swagger.config');

const initApp = () => {
  const app = express();
  expressLoader(app);
  setupSwagger(app);
  return app;
};

module.exports = initApp;
